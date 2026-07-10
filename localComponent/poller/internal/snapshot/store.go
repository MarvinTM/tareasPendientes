package snapshot

import (
	"sync"
	"time"
)

const Schema = 1

type FieldValue struct {
	V     interface{} `json:"v"`
	AgeMs int64       `json:"ageMs"`
}

type Derived struct {
	MPPT1Power   float64 `json:"mppt1Power,omitempty"`
	MPPT2Power   float64 `json:"mppt2Power,omitempty"`
	TotalPVDC    float64 `json:"totalPV,omitempty"`
	Efficiency   float64 `json:"efficiency,omitempty"`
	PVPower      float64 `json:"pvPower,omitempty"`
	BatteryPower float64 `json:"battPower,omitempty"`
}

type UnitSnapshot struct {
	InverterID string                 `json:"inverterId"`
	Model      string                 `json:"model,omitempty"`
	Serial     string                 `json:"serial,omitempty"`
	Fields     map[string]FieldValue  `json:"fields"`
	Derived    Derived               `json:"derived,omitempty"`
}

type LinkState string

const (
	LinkConnected    LinkState = "connected"
	LinkReconnecting LinkState = "reconnecting"
	LinkOffline      LinkState = "offline"
	LinkDisabled     LinkState = "disabled"
)

type LinkInfo struct {
	State       LinkState `json:"state"`
	LastSuccess time.Time `json:"lastSuccess"`
}

type SnapshotStats struct {
	Reconnects   uint64  `json:"reconnects"`
	StolenEvents uint64  `json:"stolenEvents"`
	ReadsOK      uint64  `json:"readsOK"`
	ReadsFail    uint64  `json:"readsFail"`
	HeartbeatsOK uint64  `json:"heartbeatsOK"`
	AvgRttMs     float64 `json:"avgRttMs"`
}

type Snapshot struct {
	Generated time.Time      `json:"ts"`
	Schema    int            `json:"schema"`
	Link      LinkInfo       `json:"link"`
	Units     []UnitSnapshot `json:"units"`
	Stats     SnapshotStats  `json:"stats"`
}

type fieldEntry struct {
	v interface{}
	t time.Time
}

type unitStore struct {
	id      string
	model   string
	serial  string
	fields  map[string]fieldEntry
	derived Derived
}

type Store struct {
	mu     sync.RWMutex
	units  map[string]*unitStore
	link   LinkInfo
	stats  SnapshotStats
	avg    rttAvg
}

type rttAvg struct {
	sum   float64
	count uint64
}

func NewStore(unitIDs ...string) *Store {
	s := &Store{units: make(map[string]*unitStore, len(unitIDs))}
	for _, id := range unitIDs {
		s.units[id] = &unitStore{id: id, fields: make(map[string]fieldEntry)}
	}
	return s
}

func (s *Store) SetField(unitID, fieldID string, value interface{}, readAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	us, ok := s.units[unitID]
	if !ok {
		return
	}
	us.fields[fieldID] = fieldEntry{v: value, t: readAt}
}

func (s *Store) SetIdentity(unitID, model, serial string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if us, ok := s.units[unitID]; ok {
		us.model = model
		us.serial = serial
	}
}

func (s *Store) SetDerived(unitID string, d Derived) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if us, ok := s.units[unitID]; ok {
		us.derived = d
	}
}

func (s *Store) SetLink(state LinkState, lastSuccess time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.link = LinkInfo{State: state, LastSuccess: lastSuccess}
}

func (s *Store) RecordRTT(d time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.avg.sum += float64(d.Milliseconds())
	s.avg.count++
	if s.avg.count > 0 {
		s.stats.AvgRttMs = s.avg.sum / float64(s.avg.count)
	}
}

func (s *Store) SetStats(reconnects, stolen, readsOK, readsFail, heartbeats uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.Reconnects = reconnects
	s.stats.StolenEvents = stolen
	s.stats.ReadsOK = readsOK
	s.stats.ReadsFail = readsFail
	s.stats.HeartbeatsOK = heartbeats
}

func (s *Store) Get(now time.Time) Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := Snapshot{
		Generated: now,
		Schema:    Schema,
		Link:      s.link,
		Stats:     s.stats,
		Units:     make([]UnitSnapshot, 0, len(s.units)),
	}
	for _, us := range s.units {
		usnap := UnitSnapshot{
			InverterID: us.id,
			Model:      us.model,
			Serial:     us.serial,
			Derived:    us.derived,
			Fields:     make(map[string]FieldValue, len(us.fields)),
		}
		for k, fe := range us.fields {
			age := int64(1 << 62)
			if !fe.t.IsZero() {
				age = max(0, now.Sub(fe.t).Milliseconds())
			}
			usnap.Fields[k] = FieldValue{V: fe.v, AgeMs: age}
		}
		out.Units = append(out.Units, usnap)
	}
	return out
}