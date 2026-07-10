package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"huawei-poller/internal/modbus"
	"huawei-poller/internal/poll"
	"huawei-poller/internal/registers"
	"huawei-poller/internal/snapshot"
)

type Server struct {
	link      *modbus.Link
	store     *snapshot.Store
	scheduler *poll.Scheduler
}

func New(link *modbus.Link, store *snapshot.Store, sched *poll.Scheduler) *Server {
	return &Server{link: link, store: store, scheduler: sched}
}

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/snapshot", s.handleSnapshot)
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/metrics", s.handleMetrics)
	mux.HandleFunc("/debug", s.handleDebug)
	mux.HandleFunc("/dump", s.handleDump)
	mux.HandleFunc("/scan", s.handleScan)
}

func (s *Server) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.store.Get(time.Now()))
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	snap := s.store.Get(time.Now())
	out := []string{}
	out = append(out, fmt.Sprintf("Huawei Poller — %s\n", snap.Generated.Format(time.RFC3339)))
	out = append(out, fmt.Sprintf("link: %s  lastSuccess: %s\n", snap.Link.State, snap.Link.LastSuccess.Format(time.RFC3339)))
	out = append(out, fmt.Sprintf("stats: reconnects=%d stolen=%d readsOK=%d readsFail=%d avgRTT=%.0fms\n\n",
		snap.Stats.Reconnects, snap.Stats.StolenEvents, snap.Stats.ReadsOK, snap.Stats.ReadsFail, snap.Stats.AvgRttMs))
	for _, u := range snap.Units {
		out = append(out, fmt.Sprintf("=== %s  %s ===\n", u.InverterID, registers.FormatIdentity(u.Model, u.Serial)))
		for k, fv := range u.Fields {
			out = append(out, fmt.Sprintf("  %-14s %v  (age %dms)\n", k, fv.V, fv.AgeMs))
		}
		out = append(out, "\n")
	}
	out = append(out, "endpoints: /snapshot /metrics /debug /dump?unit=1&start=32000&count=100 /scan\n")
	writeText(w, joinStr(out))
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("format") == "prom" {
		st := s.link.StatsPtr()
		fmt.Fprintf(w, "huawei_reconnects %d\nhuawei_stolen_events %d\nhuawei_reads_ok %d\nhuawei_reads_fail %d\nhuawei_heartbeats_ok %d\n",
			st.Reconnects.Load(), st.StolenEvents.Load(), st.ReadsOK.Load(), st.ReadsFail.Load(), st.HeartbeatsOK.Load())
		return
	}
	writeJSON(w, s.store.Get(time.Now()).Stats)
}

func (s *Server) handleDebug(w http.ResponseWriter, r *http.Request) {
	snap := s.store.Get(time.Now())
	out := []string{"# poller debug\n"}
	out = append(out, fmt.Sprintf("host=%s:%d\n", s.link.Host(), 502))
	out = append(out, fmt.Sprintf("state=%s lastSuccess=%s\n\n", snap.Link.State, snap.Link.LastSuccess.Format(time.RFC3339)))
	for _, u := range snap.Units {
		out = append(out, fmt.Sprintf("# %s %s\n", u.InverterID, registers.FormatIdentity(u.Model, u.Serial)))
		for k, fv := range u.Fields {
			out = append(out, fmt.Sprintf("%s.%s = %v  (age %dms)\n", u.InverterID, k, fv.V, fv.AgeMs))
		}
		out = append(out, "\n")
	}
	writeText(w, joinStr(out))
}

func (s *Server) handleDump(w http.ResponseWriter, r *http.Request) {
	unit, _ := strconv.Atoi(r.URL.Query().Get("unit"))
	if unit == 0 {
		unit = 1
	}
	start, err := strconv.Atoi(r.URL.Query().Get("start"))
	if err != nil {
		start = 32000
	}
	count, err := strconv.Atoi(r.URL.Query().Get("count"))
	if err != nil || count <= 0 {
		count = 100
	}
	if count > 100 {
		count = 100
	}
	raw, err := s.link.ReadHoldingRegisters(byte(unit), uint16(start), uint16(count))
	if err != nil {
		writeText(w, fmt.Sprintf("<read failed: %v>\n", err))
		return
	}
	out := []string{fmt.Sprintf("# dump unit=%d start=%d count=%d\n", unit, start, count)}
	for i := 0; i < len(raw); i += 8 {
		chunk := raw[i:min(i+8, len(raw))]
		line := fmt.Sprintf("  %5d:", start+i)
		for _, v := range chunk {
			line += fmt.Sprintf(" %04x", v)
		}
		out = append(out, line+"\n")
	}
	writeText(w, joinStr(out))
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	out := []string{fmt.Sprintf("# scan %s:%d\n", s.link.Host(), 502)}
	for id := 1; id <= 10; id++ {
		raw, err := s.link.ReadHoldingRegisters(byte(id), 30000, 15)
		if err != nil || raw == nil {
			continue
		}
		model := registers.Decode(raw, registers.IdentityModel)
		if model == nil {
			continue
		}
		out = append(out, fmt.Sprintf("slave %d: model=%s\n", id, model))
	}
	writeText(w, joinStr(out))
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func writeText(w http.ResponseWriter, s string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprint(w, s)
}

func joinStr(parts []string) string {
	var b []byte
	for _, p := range parts {
		b = append(b, p...)
	}
	return string(b)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}