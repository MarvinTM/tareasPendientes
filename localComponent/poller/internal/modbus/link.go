package modbus

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

type State string

const (
	StateDisconnected State = "disconnected"
	StateConnected    State = "connected"
	StateReconnecting  State = "reconnecting"
)

type Stats struct {
	Reconnects    atomic.Uint64
	StolenEvents atomic.Uint64
	ReadsOK       atomic.Uint64
	ReadsFail     atomic.Uint64
	HeartbeatsOK  atomic.Uint64
}

type Link struct {
	host string
	port int

	dialTimeout     time.Duration
	readTimeout     time.Duration
	keepAlive       time.Duration
	reconnectMin    time.Duration
	reconnectMax    time.Duration
	warmupReg       uint16
	warmupUnitIDs   []byte
	warmupMaxTries  int
	warmupRetryDelay time.Duration
	// maxTimeouts is the consecutive-timeout circuit breaker
	// threshold. When this many ErrTimeouts accrue on the same
	// connection without an intervening successful read, the
	// connection is force-closed so the next exchange() triggers
	// connectWithBackoff. 0 disables the breaker (legacy behaviour).
	// Warm-up reads (rawExchangeRead) are exempt by design: the
	// Huawei dongle's "no response to first read after TCP connect"
	// quirk requires keeping the socket alive across warm-up timeouts.
	maxTimeouts int
	// coolOff is the post-reconnect pause: after a successful dial +
	// warm-up, the poller sleeps this long before the scheduler
	// starts issuing regular reads. Gives the dongle's RS485 bus
	// time to drain any queued FusionSolar/cloud traffic before
	// we contend for it. 0 disables.
	coolOff time.Duration

	mu        sync.Mutex
	connectMu sync.Mutex
	conn      *net.TCPConn
	txnID     uint16
	state     State
	lastSuccess time.Time
	// consecutiveTimeouts counts ErrTimeouts on the current
	// connection since the last successful read. Reset to 0 by
	// markSuccess(). Protected by l.mu.
	consecutiveTimeouts int

	stats Stats
}

func New(host string, port int, dialTimeout, readTimeout, keepAlive, recMin, recMax time.Duration, maxTimeouts int, coolOff time.Duration) *Link {
	return &Link{
		host: host, port: port,
		dialTimeout:     dialTimeout,
		readTimeout:     readTimeout,
		keepAlive:       keepAlive,
		reconnectMin:    recMin,
		reconnectMax:    recMax,
		warmupReg:       30070,
		warmupUnitIDs:   []byte{1, 2},
		warmupMaxTries:  5,
		warmupRetryDelay: 2 * time.Second,
		maxTimeouts:     maxTimeouts,
		coolOff:         coolOff,
		state:           StateDisconnected,
	}
}

func (l *Link) Host() string            { return l.host }
func (l *Link) State() State            { l.mu.Lock(); defer l.mu.Unlock(); return l.state }
func (l *Link) LastSuccess() time.Time  { l.mu.Lock(); defer l.mu.Unlock(); return l.lastSuccess }
func (l *Link) StatsPtr() *Stats        { return &l.stats }
func (l *Link) markSuccess() {
	l.mu.Lock()
	l.lastSuccess = time.Now()
	l.consecutiveTimeouts = 0
	l.mu.Unlock()
}

// dial opens a TCP connection. Caller must NOT hold l.mu — dial acquires it
// internally to set l.conn.
func (l *Link) dial() error {
	addr := net.JoinHostPort(l.host, strconv.Itoa(l.port))
	d := net.Dialer{Timeout: l.dialTimeout, KeepAlive: l.keepAlive}
	c, err := d.Dial("tcp", addr)
	if err != nil {
		return err
	}
	tcp, ok := c.(*net.TCPConn)
	if !ok {
		c.Close()
		return errors.New("non-TCP connection")
	}
	if err := tcp.SetKeepAlive(true); err != nil {
		log.Printf("modbus: SetKeepAlive(true) failed: %v", err)
	}
	if err := tcp.SetKeepAlivePeriod(l.keepAlive); err != nil {
		log.Printf("modbus: SetKeepAlivePeriod failed: %v", err)
	}
	if err := tcp.SetNoDelay(true); err != nil {
		log.Printf("modbus: SetNoDelay failed: %v", err)
	}
	l.mu.Lock()
	l.conn = tcp
	l.state = StateConnected
	l.mu.Unlock()
	l.stats.Reconnects.Add(1)
	log.Printf("modbus: connected to %s", addr)
	return nil
}

// connectWithBackoff dials, establishes a connection AND performs warm-up
// reads. The dongle's firmware does NOT respond to Modbus requests
// immediately after a TCP connect — the old Node ingest.js did 3 rounds of
// warm-up reads with 2s delays. We replicate that here: after dialing, we
// issue small reads (register 30070, count 1) up to warmupMaxTries times
// until the dongle responds. Only then do we declare "connected".
//
// connectMu serializes this — only one goroutine connects at a time. This
// prevents two scheduler goroutines from opening competing TCP connections
// (the dongle only allows one Modbus client at a time).
func (l *Link) connectWithBackoff() error {
	l.connectMu.Lock()
	defer l.connectMu.Unlock()

	backoff := l.reconnectMin
	for outerAttempt := 1; ; outerAttempt++ {
		// Another goroutine may have connected while we waited on connectMu.
		l.mu.Lock()
		if l.conn != nil {
			l.mu.Unlock()
			return nil
		}
		l.state = StateReconnecting
		l.mu.Unlock()

		if err := l.dial(); err != nil {
			if backoff > l.reconnectMax {
				backoff = l.reconnectMax
			}
			log.Printf("modbus: dial failed (attempt %d, backoff %s): %v", outerAttempt, backoff, err)
			time.Sleep(backoff)
			backoff *= 2
			continue
		}

		// Warm-up: the dongle needs repeated small reads before it starts
		// responding. Try reading register 30070 on both units.
		warmupDone := false
		for warmupTry := 1; warmupTry <= l.warmupMaxTries; warmupTry++ {
			if warmupTry > 1 {
				time.Sleep(l.warmupRetryDelay)
				// Re-check: after a failed warm-up read, exchange() may have
				// closed l.conn. Re-dial if needed.
				l.mu.Lock()
				needRedial := l.conn == nil
				l.mu.Unlock()
				if needRedial {
					log.Printf("modbus: warm-up read closed conn, re-dialing...")
					if err := l.dial(); err != nil {
						log.Printf("modbus: warm-up re-dial failed: %v", err)
						continue
					}
				}
			}
for _, unit := range l.warmupUnitIDs {
			// Use rawExchange (not ReadHoldingRegisters) so we don't
			// recursively call connectWithBackoff when conn is nil.
			_, err := l.rawExchangeRead(unit, l.warmupReg, 1)
			if err == nil {
				l.stats.ReadsOK.Add(1)
				l.stats.HeartbeatsOK.Add(1)
				l.markSuccess()
				warmupDone = true
				log.Printf("modbus: warm-up succeeded (unit %d, try %d)", unit, warmupTry)
				break
			}
			l.stats.ReadsFail.Add(1)
			log.Printf("modbus: warm-up read failed (unit %d, try %d): %v", unit, warmupTry, err)
		}
			if warmupDone {
				break
			}
		}

		if warmupDone {
			if l.coolOff > 0 {
				log.Printf("modbus: cool-off %s after warm-up before releasing to scheduler", l.coolOff)
				time.Sleep(l.coolOff)
			}
			return nil
		}

		// All warm-up attempts failed — close the connection and retry the
		// whole dial+warmup cycle.
		log.Printf("modbus: warm-up failed after %d tries, closing and retrying", l.warmupMaxTries)
		l.mu.Lock()
		l.closeLocked()
		l.mu.Unlock()
		time.Sleep(backoff)
		backoff *= 2
	}
}

// ReadHoldingRegisters issues a Modbus FC 0x03 request, owning its own timeout
// (which Net.Socket/modbus-serial did not).
func (l *Link) ReadHoldingRegisters(unit byte, addr, count uint16) ([]uint16, error) {
	req := buildReadReq(0x03, addr, count)
	resp, err := l.exchange(unit, req, func(byteCount byte) int { return int(byteCount) / 2 })
	if err != nil {
		l.stats.ReadsFail.Add(1)
		return nil, err
	}
	l.stats.ReadsOK.Add(1)
	l.markSuccess()
	return resp, nil
}

func (l *Link) Heartbeat(unit byte, reg uint16) error {
	if _, err := l.ReadHoldingRegisters(unit, reg, 1); err != nil {
		return err
	}
	l.stats.HeartbeatsOK.Add(1)
	return nil
}

// ErrTimeout is returned when a Modbus read times out but the TCP
// connection may still be alive. The caller can choose to retry on the
// same connection (warm-up) or close (regular read). This is critical for
// the Huawei dongle: its firmware does not respond to the first Modbus
// request after a TCP connect, but DOES respond to subsequent reads on
// the same socket. Closing the connection after every timeout (the old
// code's behaviour) means the poller never reaches the second read.
var ErrTimeout = errors.New("modbus: i/o timeout")

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	var ne net.Error
	if errors.As(err, &ne) {
		return ne.Timeout()
	}
	return false
}

// doTransactionLocked sends a Modbus request and reads the response.
// Assumes l.mu is held and l.conn is non-nil. On timeout returns ErrTimeout
// WITHOUT closing the connection — the connection may still be alive and
// subsequent reads on the same socket may succeed (Huawei dongle quirk).
// On EOF/connection-reset/other fatal errors, closes the connection.
func (l *Link) doTransactionLocked(unit byte, req []byte, expectLen func(byteCount byte) int) ([]uint16, error) {
	if err := l.conn.SetDeadline(time.Now().Add(l.readTimeout)); err != nil {
		l.closeLocked()
		return nil, fmt.Errorf("set deadline: %w", err)
	}

	frames := buildMBAP(unit, req, &l.txnID)
	if _, err := l.conn.Write(frames); err != nil {
		if isTimeoutErr(err) {
			return nil, fmt.Errorf("%w: write", ErrTimeout)
		}
		if isUnexpectedEOF(err) {
			l.stats.StolenEvents.Add(1)
			log.Printf("modbus: unexpected EOF on write (possible connection steal): %v", err)
		}
		l.closeLocked()
		return nil, fmt.Errorf("write: %w", err)
	}

	mbap, err := readN(l.conn, 7)
	if err != nil {
		if isTimeoutErr(err) {
			log.Printf("modbus: read mbap timed out, keeping connection alive")
			return nil, fmt.Errorf("%w: read mbap", ErrTimeout)
		}
		if isUnexpectedEOF(err) {
			l.stats.StolenEvents.Add(1)
			log.Printf("modbus: unexpected EOF on read (possible connection steal): %v", err)
		}
		log.Printf("modbus: read mbap failed (closing conn): %T: %v", err, err)
		l.closeLocked()
		return nil, fmt.Errorf("read mbap: %w", err)
	}

	inTxn, _, inLen := parseMBAP(mbap)
	// buildMBAP increments txnID before sending, so the sent txn == l.txnID.
	// The response must echo the same transaction ID.
	if inTxn != l.txnID {
		log.Printf("modbus: txn mismatch (got %d, want %d), closing conn", inTxn, l.txnID)
		l.closeLocked()
		return nil, errors.New("transaction id mismatch")
	}

	// Length field counts from the Unit ID byte (part of the MBAP header).
	// So the remaining PDU is inLen-1 bytes.
	pdu, err := readN(l.conn, int(inLen)-1)
	if err != nil {
		if isTimeoutErr(err) {
			return nil, fmt.Errorf("%w: read pdu", ErrTimeout)
		}
		l.closeLocked()
		return nil, fmt.Errorf("read pdu: %w", err)
	}

	if len(pdu) == 0 {
		l.closeLocked()
		return nil, errors.New("empty pdu")
	}
	if pdu[0]&0x80 != 0 {
		if len(pdu) >= 2 {
			return nil, fmt.Errorf("modbus exception %d", pdu[1])
		}
		return nil, errors.New("modbus exception (no code)")
	}
	if pdu[0] != req[0] {
		l.closeLocked()
		return nil, fmt.Errorf("function code mismatch: got %d want %d", pdu[0], req[0])
	}
	if len(pdu) < 2 {
		return nil, errors.New("pdu too short for data")
	}
	byteCount := pdu[1]
	want := expectLen(byteCount)
	if want < 0 || len(pdu)-2 < want*2 {
		return nil, fmt.Errorf("byte count %d does not match available data", byteCount)
	}
	registerBytes := pdu[2 : 2+byteCount]
	if len(registerBytes)%2 != 0 {
		return nil, errors.New("odd register byte count")
	}
	out := make([]uint16, len(registerBytes)/2)
	for i := range out {
		out[i] = binary.BigEndian.Uint16(registerBytes[i*2:])
	}
	return out, nil
}

// rawExchangeRead is a low-level read for use during warm-up. Acquires l.mu
// (single lock, no recursion) then calls doTransactionLocked. Does NOT
// reconnect — if conn is nil or the read fails, returns error so caller can
// decide whether to re-dial.
func (l *Link) rawExchangeRead(unit byte, addr, count uint16) ([]uint16, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.conn == nil {
		return nil, errors.New("no connection")
	}
	req := buildReadReq(0x03, addr, count)
	resp, err := l.doTransactionLocked(unit, req, func(byteCount byte) int { return int(byteCount) / 2 })
	if err != nil && errors.Is(err, ErrTimeout) {
		// Drain any delayed bytes the dongle sent after the deadline.
		// The Huawei dongle often responds late to the first read(s) after a
		// TCP connect; those bytes would pollute the next read's stream and
		// cause a transaction-ID mismatch that closes the connection.
		l.drainLocked()
	}
	return resp, err
}

// drainLocked discards any buffered data from the TCP receive buffer.
// Caller must hold l.mu and l.conn must be non-nil.
func (l *Link) drainLocked() {
	l.conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	buf := make([]byte, 256)
	for {
		n, err := l.conn.Read(buf)
		if n > 0 {
			log.Printf("modbus: drained %d stale bytes", n)
		}
		if err != nil || n == 0 {
			break
		}
	}
}

// exchange serializes a single Modbus TCP transaction. Acquires l.mu, checks
// the connection under the lock, reconnects if needed, then runs the read.
// This is the entry point for regular ops (ReadHoldingRegisters → exchange).
func (l *Link) exchange(unit byte, req []byte, expectLen func(byteCount byte) int) ([]uint16, error) {
	l.mu.Lock()
	// Re-check under the lock — another goroutine may have closed it.
	for l.conn == nil {
		l.mu.Unlock()
		if err := l.connectWithBackoff(); err != nil {
			return nil, err
		}
		l.mu.Lock()
	}
	defer l.mu.Unlock()
	resp, err := l.doTransactionLocked(unit, req, expectLen)
	if err != nil && errors.Is(err, ErrTimeout) {
		l.drainLocked()
		// Consecutive-timeout circuit breaker: a TCP-alive-but-Modbus-dead
		// socket (the "connection reset by peer" → redial → silent second
		// socket failure mode) produces an unbounded stream of ErrTimeouts
		// that never trigger closeLocked (see doTransactionLocked). After
		// maxTimeouts consecutive timeouts with no successful read in
		// between, force-close so the next exchange() redials. Without this
		// the link stalls forever and only a manual pm2 restart recovers it.
		if l.maxTimeouts > 0 {
			l.consecutiveTimeouts++
			if l.consecutiveTimeouts >= l.maxTimeouts {
				log.Printf("modbus: %d consecutive timeouts (max %d), closing conn to force reconnect",
					l.consecutiveTimeouts, l.maxTimeouts)
				l.closeLocked()
				l.consecutiveTimeouts = 0
			}
		}
	}
	return resp, err
}

// closeLocked closes the connection. Caller must hold l.mu.
func (l *Link) closeLocked() {
	if l.conn != nil {
		l.conn.Close()
		l.conn = nil
	}
	l.state = StateDisconnected
}

func (l *Link) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.closeLocked()
}

func buildMBAP(unit byte, pdu []byte, txnID *uint16) []byte {
	*txnID++
	buf := make([]byte, 7+len(pdu))
	binary.BigEndian.PutUint16(buf[0:], *txnID)
	binary.BigEndian.PutUint16(buf[2:], 0)
	binary.BigEndian.PutUint16(buf[4:], uint16(1+len(pdu)))
	buf[6] = unit
	copy(buf[7:], pdu)
	return buf
}

func parseMBAP(b []byte) (txn, proto, length uint16) {
	txn = binary.BigEndian.Uint16(b[0:])
	proto = binary.BigEndian.Uint16(b[2:])
	length = binary.BigEndian.Uint16(b[4:])
	return
}

func buildReadReq(fc byte, addr, count uint16) []byte {
	buf := make([]byte, 5)
	buf[0] = fc
	binary.BigEndian.PutUint16(buf[1:], addr)
	binary.BigEndian.PutUint16(buf[3:], count)
	return buf
}

func readN(r io.Reader, n int) ([]byte, error) {
	out := make([]byte, n)
	if _, err := io.ReadFull(r, out); err != nil {
		return nil, err
	}
	return out, nil
}

func isUnexpectedEOF(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, net.ErrClosed)
}