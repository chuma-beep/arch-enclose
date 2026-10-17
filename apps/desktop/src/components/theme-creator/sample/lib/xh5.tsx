import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
  pin4: ["pin4"],
  pin5: ["pin5"],
} as const

export const B5B_XH_A_LF__SN_ = (props: ChipProps<typeof pinLabels>) => {
  return (
    <connector
      pinLabels={pinLabels}
      supplierPartNumbers={{
        jlcpcb: ["C157991"],
      }}
      manufacturerPartNumber="B5B-XH-A(LF)(SN)"
      footprint="jst5_xh"
      {...props}
    />
  )
}
