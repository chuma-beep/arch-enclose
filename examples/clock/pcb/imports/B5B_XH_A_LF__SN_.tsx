import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
  pin4: ["pin4"],
  pin5: ["pin5"]
} as const

export const B5B_XH_A_LF__SN_ = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C157991"
  ]
}}
      manufacturerPartNumber="B5B-XH-A(LF)(SN)"
      footprint="pinrow5_p2.5mm_od1.8mm_id1.2mm_pin1location(rightside,top)"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C157991.obj?uuid=9711208b2b1f45589f7edb7a0439d8bc",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C157991.step?uuid=9711208b2b1f45589f7edb7a0439d8bc",
        pcbRotationOffset: 180,
        modelOriginPosition: { x: 4.999009399999977, y: 0, z: 0.49999300000000035 },
      }}
      {...props}
    />
  )
}