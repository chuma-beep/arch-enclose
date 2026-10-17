import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
} as const

export const B3B_XH_A_LF__SN_ = (props: ChipProps<typeof pinLabels>) => {
  return (
    <connector
      pinLabels={pinLabels}
      supplierPartNumbers={{
        jlcpcb: ["C144394"],
      }}
      manufacturerPartNumber="B3B-XH-A(LF)(SN)"
      footprint="jst3_xh"
      {...props}
    />
  )
}
