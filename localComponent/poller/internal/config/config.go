package config

import (
	"flag"
	"os"
	"strconv"
	"time"
)

type Config struct {
	ModbusHost string
	ModbusPort int
	UnitMaster byte
	UnitSlave  byte

LinkDialTimeout  time.Duration
	LinkReadTimeout time.Duration
	LinkKeepAlive   time.Duration
	ReconnectMin    time.Duration
	ReconnectMax    time.Duration
	HeartbeatReg    uint16
	StartupWarmups  int
	// LinkMaxTimeouts is the consecutive-timeout circuit breaker
	// threshold (see modbus.Link). 3 means: after 3 ErrTimeouts in a
	// row with no successful read, force-close and reconnect.
	LinkMaxTimeouts int
	// LinkFreshness is the last-success watchdog threshold. If no
	// successful Modbus read has occurred in this duration, the poller
	// force-closes the connection to trigger reconnect — catches stalls
	// that don't surface as ErrTimeout (half-up sockets, scheduler
	// goroutine death, etc.).
	LinkFreshness time.Duration

	CadenceInverter time.Duration
	CadenceMeter    time.Duration
	BlockMinGap     time.Duration
	BlockMaxRTT     time.Duration

	HTTPListen string

	BatteryPowerMultiplier float64
	LinkDisabled           bool
}

func Defaults() Config {
	return Config{
		ModbusHost: "192.168.1.230",
		ModbusPort: 502,
		UnitMaster: 1,
		UnitSlave:  2,

		LinkDialTimeout:   5 * time.Second,
		LinkReadTimeout:   8 * time.Second,
		LinkKeepAlive:     15 * time.Second,
		ReconnectMin:      1 * time.Second,
		ReconnectMax:      60 * time.Second,
		HeartbeatReg:      30070,
		StartupWarmups:   0,
		LinkMaxTimeouts:   3,
		LinkFreshness:     45 * time.Second,

		CadenceInverter: 15 * time.Second,
		CadenceMeter:    3 * time.Second,
		BlockMinGap:     80 * time.Millisecond,
		BlockMaxRTT:     6 * time.Second,

		HTTPListen: "127.0.0.1:8765",

		BatteryPowerMultiplier: 1.0,
		LinkDisabled:           false,
	}
}

func FromEnv() Config {
	c := Defaults()
	if v := os.Getenv("POLLER_HOST"); v != "" {
		c.ModbusHost = v
	}
	if v := os.Getenv("POLLER_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			c.ModbusPort = p
		}
	}
	if v := os.Getenv("POLLER_LISTEN"); v != "" {
		c.HTTPListen = v
	}
	if v := os.Getenv("LINK_DISABLED"); v == "1" || v == "true" {
		c.LinkDisabled = true
	}
	if v := os.Getenv("CADENCE_INVERTER_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil {
			c.CadenceInverter = d
		}
	}
	if v := os.Getenv("CADENCE_METER_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil {
			c.CadenceMeter = d
		}
	}
	if v := os.Getenv("BATTERY_POWER_MULTIPLIER"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			c.BatteryPowerMultiplier = f
		}
	}
	if v := os.Getenv("LINK_KEEPALIVE_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil {
			c.LinkKeepAlive = d
		}
	}
	if v := os.Getenv("LINK_READ_TIMEOUT_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil {
			c.LinkReadTimeout = d
		}
	}
	if v := os.Getenv("LINK_MAX_TIMEOUTS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.LinkMaxTimeouts = n
		}
	}
	if v := os.Getenv("LINK_FRESHNESS_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil {
			c.LinkFreshness = d
		}
	}
	return c
}

func Flags(c *Config) {
	flag.StringVar(&c.ModbusHost, "host", c.ModbusHost, "Huawei dongle host")
	flag.IntVar(&c.ModbusPort, "port", c.ModbusPort, "Huawei dongle Modbus TCP port")
	flag.StringVar(&c.HTTPListen, "listen", c.HTTPListen, "HTTP listen address for /snapshot etc.")
	flag.BoolVar(&c.LinkDisabled, "link-disabled", c.LinkDisabled, "observe-only: open no Modbus connection")
	flag.Float64Var(&c.BatteryPowerMultiplier, "battery-power-mult", c.BatteryPowerMultiplier, "battery power multiplier (validate against frontend energy math; default 1.0, legacy Node impl used 2.0)")
}