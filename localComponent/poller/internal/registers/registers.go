package registers

import (
	"encoding/binary"
	"fmt"
	"math"
	"strings"
)

type Type string

const (
	TypeUint16 Type = "uint16"
	TypeInt16  Type = "int16"
	TypeUint32 Type = "uint32"
	TypeInt32  Type = "int32"
	TypeString Type = "string"
)

type Cadence string

const (
	CadOnce     Cadence = "once"
	CadInverter Cadence = "inverter"
	CadMeter    Cadence = "meter"
)

type Block struct {
	Start   uint16
	Count   uint16
	Cadence Cadence
	Comment string
}

type Field struct {
	ID    string
	Label string
	Addr  uint16
	Count uint16
	Type  Type
	Scale float64
	Unit  string
	Desc  string
}

type UnitKey string

const (
	UnitMaster UnitKey = "master"
	UnitSlave  UnitKey = "slave"
)

func IdentityBlocks() []Block {
	return []Block{
		{Start: 30000, Count: 30, Cadence: CadOnce, Comment: "Identity (30000-30029)"},
	}
}

func InverterBlocks() []Block {
	return []Block{
		{Start: 32000, Count: 90, Cadence: CadInverter, Comment: "Status + PV + Yield + Grid (32000-32089)"},
		{Start: 37000, Count: 20, Cadence: CadInverter, Comment: "Battery telemetry (37000-37019) — master only"},
		{Start: 40100, Count: 30, Cadence: CadInverter, Comment: "Power limit config (40100-40129) — includes 40118"},
	}
}

func MeterBlocks() []Block {
	return []Block{
		{Start: 37100, Count: 20, Cadence: CadMeter, Comment: "Smart meter (37100-37119) — master only"},
	}
}

func UnitBlocks(unit UnitKey) []Block {
	switch unit {
	case UnitMaster:
		out := make([]Block, 0, 5)
		out = append(out, InverterBlocks()...)
		out = append(out, MeterBlocks()...)
		return out
	case UnitSlave:
		return []Block{{Start: 32000, Count: 90, Cadence: CadInverter, Comment: "Status + PV + Yield (32000-32089)"}}
	}
	return nil
}

var InverterFields = []Field{
	{ID: "pv1Voltage", Label: "PV1 Voltage", Addr: 32016, Count: 1, Type: TypeUint16, Scale: 0.1, Unit: "V"},
	{ID: "pv1Current", Label: "PV1 Current", Addr: 32017, Count: 1, Type: TypeUint16, Scale: 0.01, Unit: "A"},
	{ID: "pv2Voltage", Label: "PV2 Voltage", Addr: 32018, Count: 1, Type: TypeUint16, Scale: 0.1, Unit: "V"},
	{ID: "pv2Current", Label: "PV2 Current", Addr: 32019, Count: 1, Type: TypeUint16, Scale: 0.01, Unit: "A"},
	{ID: "activePower", Label: "Active Power", Addr: 32080, Count: 2, Type: TypeInt32, Unit: "W"},
	{ID: "gridVoltage", Label: "Grid Voltage", Addr: 32069, Count: 1, Type: TypeUint16, Scale: 0.1, Unit: "V"},
	{ID: "temperature", Label: "Temperature", Addr: 32087, Count: 1, Type: TypeUint16, Scale: 0.1, Unit: "C"},
	{ID: "runningState", Label: "Running State", Addr: 32000, Count: 1, Type: TypeUint16},
}

var MeterFields = []Field{
	{ID: "meterPower", Label: "Meter Active Power", Addr: 37113, Count: 2, Type: TypeInt32, Unit: "W", Desc: "+import / -export"},
}

var BatteryFields = []Field{
	{ID: "battSoc", Label: "Batt SOC", Addr: 37004, Count: 1, Type: TypeUint16, Scale: 0.1, Unit: "%"},
	{ID: "battCurrent", Label: "Batt Current", Addr: 37002, Count: 1, Type: TypeInt16, Scale: 0.01, Unit: "A", Desc: "Huawei native: -charge / +discharge"},
	{ID: "battVoltage", Label: "Batt Voltage", Addr: 37003, Count: 1, Type: TypeUint16, Scale: 0.01, Unit: "V"},
}

var PowerLimitFields = []Field{
	{ID: "gridPwrLimit", Label: "Grid Pwr Limit", Addr: 40118, Count: 1, Type: TypeUint16, Unit: "W"},
}

func UnitFields(unit UnitKey) []Field {
	switch unit {
	case UnitMaster:
		out := make([]Field, 0, 16)
		out = append(out, InverterFields...)
		out = append(out, BatteryFields...)
		out = append(out, MeterFields...)
		out = append(out, PowerLimitFields...)
		return out
	case UnitSlave:
		return InverterFields
	}
	return nil
}

func Decode(raw []uint16, f Field) interface{} {
	if int(Count(f)) > len(raw) {
		return nil
	}
	switch f.Type {
	case TypeUint16:
		return scaled(float64(raw[0]), f.Scale)
	case TypeInt16:
		v := int16(raw[0])
		return scaled(float64(v), f.Scale)
	case TypeUint32:
		return scaled(float64(uint32(raw[0])<<16|uint32(raw[1])), f.Scale)
	case TypeInt32:
		u := uint32(raw[0])<<16 | uint32(raw[1])
		// Two's-complement decode via int64 to avoid int32 overflow.
		var iv int64
		if u >= 0x80000000 {
			iv = int64(u) - 0x100000000
		} else {
			iv = int64(u)
		}
		return scaled(float64(iv), f.Scale)
	case TypeString:
		return parseString(raw)
	}
	return nil
}

func scaled(v float64, scale float64) float64 {
	if scale != 0 && scale != 1 {
		return roundTo(v*scale, scale)
	}
	return v
}

func roundTo(v, scale float64) float64 {
	digits := 0
	for x := scale; x < 1 && x > 0; x *= 10 {
		digits++
	}
	shift := math.Pow(10, float64(digits))
	if scale == 0.1 {
		return math.Round(v*10) / 10
	}
	return math.Round(v*shift) / shift
}

func parseString(raw []uint16) string {
	buf := make([]byte, len(raw)*2)
	for i, r := range raw {
		binary.BigEndian.PutUint16(buf[i*2:], r)
	}
	return strings.Trim(strings.ReplaceAll(string(buf), "\x00", ""), " \t\r\n")
}

func Count(f Field) uint16 { return f.Count }

func roundFloat(v float64, digits int) float64 {
	shift := math.Pow(10, float64(digits))
	return math.Round(v*shift) / shift
}

type Derived struct {
	MPPT1Power  float64 `json:"mppt1Power"`
	MPPT2Power  float64 `json:"mppt2Power"`
	TotalPVDC   float64 `json:"totalPV,omitempty"`
	Efficiency  float64 `json:"efficiency,omitempty"`
	PVPower     float64 `json:"pvPower,omitempty"`
	BatteryPower float64 `json:"battPower,omitempty"`
}

// ComputeDerived mirrors the per-inverter derived computations from the legacy
// huawei-registers.js, plus pvPower (what ingest.js computed inline) and
// battPower (scaled by the configured multiplier; legacy Node used 2.0 — that
// must be validated against the frontend energy-balance math, so it is now an
// explicit config knob defaulting to 1.0).
func ComputeDerived(vals map[string]float64, battPowerMult float64) Derived {
	d := Derived{}
	pv1V, pv1I := vals["pv1Voltage"], vals["pv1Current"]
	pv2V, pv2I := vals["pv2Voltage"], vals["pv2Current"]
	acPwr := vals["activePower"]

	p1ok := pv1V > 0 && pv1I > 0
	p2ok := pv2V > 0 && pv2I > 0
	if p1ok {
		d.MPPT1Power = roundFloat(pv1V*pv1I, 1)
	}
	if p2ok {
		d.MPPT2Power = roundFloat(pv2V*pv2I, 1)
	}
	if p1ok || p2ok {
		d.PVPower = roundFloat(d.MPPT1Power+d.MPPT2Power, 1)
	}
	if d.PVPower > 0 {
		d.TotalPVDC = d.PVPower
		if acPwr > 0 {
			d.Efficiency = math.Round(acPwr/d.PVPower*1000) / 10
		}
	}

	if bI, ok := vals["battCurrent"]; ok {
		if bV, ok2 := vals["battVoltage"]; ok && ok2 {
			d.BatteryPower = math.Round(bI * bV * battPowerMult)
		}
	}
	return d
}

var IdentityModel = Field{ID: "model", Label: "Model", Addr: 30000, Count: 15, Type: TypeString}
var IdentitySerial = Field{ID: "serial", Label: "Serial Number", Addr: 30015, Count: 10, Type: TypeString}

func FormatIdentity(model, serial string) string {
	if model == "" {
		model = "<unknown>"
	}
	if serial == "" {
		serial = "<unknown>"
	}
	return fmt.Sprintf("%s [%s]", model, serial)
}