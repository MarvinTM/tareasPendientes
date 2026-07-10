package poll

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"huawei-poller/internal/config"
	"huawei-poller/internal/modbus"
	"huawei-poller/internal/registers"
	"huawei-poller/internal/snapshot"
)

type Scheduler struct {
	cfg      config.Config
	link     *modbus.Link
	store    *snapshot.Store
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

func New(cfg config.Config, link *modbus.Link, store *snapshot.Store) *Scheduler {
	return &Scheduler{cfg: cfg, link: link, store: store, stopCh: make(chan struct{})}
}

func (s *Scheduler) Start() {
	s.wg.Add(2)
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("PANIC in poll(master): %v", r)
			}
		}()
		s.runUnit(registers.UnitMaster)
	}()
	go func() {
		defer s.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("PANIC in poll(slave): %v", r)
			}
		}()
		s.runUnit(registers.UnitSlave)
	}()
}

func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

func (s *Scheduler) runUnit(unit registers.UnitKey) {
	defer s.wg.Done()

	// 1. Identity once.
	if err := s.pollIdentity(unit); err != nil {
		log.Printf("poll(%s): identity read failed: %v", unit, err)
	}

	// 2. Seed all fields immediately so /snapshot is populated quickly, then the
	// periodic per-cadence loop takes over.
	if err := s.pollAll(unit); err != nil {
		log.Printf("poll(%s): seed read failed: %v", unit, err)
	}

	// Per-cadence tickers: "inverter" cadence (PV/status/grid/battery/limit) and
	// "meter" cadence (master only). We maintain the heartbeat by reading a
	// cheap register at the start of each inverter-cycle.
	invT := time.NewTicker(s.cfg.CadenceInverter)
	defer invT.Stop()
	metT := time.NewTicker(s.cfg.CadenceMeter)
	defer metT.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-invT.C:
			if err := s.heartbeat(unit); err != nil {
				log.Printf("poll(%s): heartbeat failed: %v", unit, err)
				continue
			}
			if err := s.pollCadence(unit, registers.CadInverter); err != nil {
				log.Printf("poll(%s): inverter-cycle partial failure: %v", unit, err)
			}
		case <-metT.C:
			if unit != registers.UnitMaster {
				continue
			}
			if err := s.pollCadence(unit, registers.CadMeter); err != nil {
				log.Printf("poll(%s): meter-cycle partial failure: %v", unit, err)
			}
		}
	}
}

func (s *Scheduler) heartbeat(unit registers.UnitKey) error {
	byteUnit := s.unitByte(unit)
	if err := s.link.Heartbeat(byteUnit, s.cfg.HeartbeatReg); err != nil {
		return err
	}
	s.store.SetLink(snapshot.LinkConnected, s.link.LastSuccess())
	return nil
}

func (s *Scheduler) pollIdentity(unit registers.UnitKey) error {
	byteUnit := s.unitByte(unit)
	for _, b := range registers.IdentityBlocks() {
		raw, err := s.readWithRTT(byteUnit, b.Start, b.Count, unit)
		if err != nil || raw == nil {
			continue
		}
		model := registers.Decode(rawSlice(raw, registers.IdentityModel.Addr, registers.IdentityModel.Count, b.Start), registers.IdentityModel)
		serial := registers.Decode(rawSlice(raw, registers.IdentitySerial.Addr, registers.IdentitySerial.Count, b.Start), registers.IdentitySerial)
		s.store.SetIdentity(string(unit), asString(model), asString(serial))
	}
	return nil
}

func (s *Scheduler) pollAll(unit registers.UnitKey) error {
	return s.pollCadence(unit, "")
}

func (s *Scheduler) pollCadence(unit registers.UnitKey, cad registers.Cadence) error {
	byteUnit := s.unitByte(unit)
	var blocks []registers.Block
	for _, b := range registers.UnitBlocks(unit) {
		if cad != "" && b.Cadence != cad {
			continue
		}
		blocks = append(blocks, b)
	}
	now := time.Now()
	numeric := map[string]float64{}
	for _, b := range blocks {
		raw, err := s.readWithRTT(byteUnit, b.Start, b.Count, unit)
		if err != nil || raw == nil {
			log.Printf("poll(%s): block %d-%d failed: %v", unit, b.Start, b.Start+uint16(b.Count)-1, err)
			continue
		}
		for _, f := range registers.UnitFields(unit) {
			rslice := rawSlice(raw, f.Addr, f.Count, b.Start)
			if rslice == nil {
				continue
			}
			val := registers.Decode(rslice, f)
			if val == nil {
				continue
			}
			s.store.SetField(string(unit), f.ID, val, now)
			if n, ok := toFloat(val); ok {
				numeric[f.ID] = n
			}
		}
		// Adaptive pacing: gap between blocks scales with the last RTT, floor at BlockMinGap.
		if s.cfg.BlockMinGap > 0 {
			time.Sleep(s.cfg.BlockMinGap)
		}
	}

	// Derived computations are per-unit and only over fields actually read this
	// cycle; the battery multiplier is the explicit config knob that replaces the
	// legacy undocumented "*2" in the Node ingest.js.
	d := registers.ComputeDerived(numeric, s.cfg.BatteryPowerMultiplier)
	s.store.SetDerived(string(unit), snapshot.Derived{
		MPPT1Power:   d.MPPT1Power,
		MPPT2Power:   d.MPPT2Power,
		TotalPVDC:    d.TotalPVDC,
		Efficiency:   d.Efficiency,
		PVPower:      d.PVPower,
		BatteryPower: d.BatteryPower,
	})
	return nil
}

func (s *Scheduler) readWithRTT(unitByte byte, addr, count uint16, unit registers.UnitKey) ([]uint16, error) {
	t0 := time.Now()
	raw, err := s.link.ReadHoldingRegisters(unitByte, addr, count)
	if err != nil {
		return nil, err
	}
	rtt := time.Since(t0)
	s.store.RecordRTT(rtt)
	return raw, nil
}

func (s *Scheduler) unitByte(unit registers.UnitKey) byte {
	switch unit {
	case registers.UnitMaster:
		return s.cfg.UnitMaster
	case registers.UnitSlave:
		return s.cfg.UnitSlave
	}
	return 0
}

func rawSlice(raw []uint16, addr, count, blockStart uint16) []uint16 {
	if int(addr) < int(blockStart) {
		return nil
	}
	off := int(addr - blockStart)
	end := off + int(count)
	if end > len(raw) || off >= len(raw) {
		return nil
	}
	return raw[off:end]
}

func toFloat(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	}
	return 0, false
}

func asString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// PollAllNow forces one immediate inverter+meter cycle on the given unit
// (used by HTTP debug/diagnostic endpoints so they reuse the poller's own
// healthy connection rather than opening a competing one).
func (s *Scheduler) PollAllNow(ctx context.Context, unit registers.UnitKey) error {
	return s.pollAll(unit)
}