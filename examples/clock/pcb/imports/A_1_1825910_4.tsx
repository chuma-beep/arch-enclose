import type { PushButtonProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["pin1"],
  pin2: ["pin2"],
  pin3: ["pin3"],
  pin4: ["pin4"]
} as const

export const A_1_1825910_4 = (props: PushButtonProps<typeof pinLabels>) => {
  const { name = "SW1", ...restProps } = props

  return (
    <pushbutton
      name={name}
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C589907"
  ]
}}
      manufacturerPartNumber="1-1825910-4"
      footprint={<footprint>
        <platedhole  portHints={["pin1"]} pcbX="-3.24993mm" pcbY="-2.249932mm" outerDiameter="1.999996mm" holeDiameter="1.199896mm" shape="circle" />
<platedhole  portHints={["pin2"]} pcbX="3.24993mm" pcbY="-2.249932mm" outerDiameter="1.999996mm" holeDiameter="1.199896mm" shape="circle" />
<platedhole  portHints={["pin3"]} pcbX="3.24993mm" pcbY="2.249932mm" outerDiameter="1.999996mm" holeDiameter="1.199896mm" shape="circle" />
<platedhole  portHints={["pin4"]} pcbX="-3.24993mm" pcbY="2.249932mm" outerDiameter="1.999996mm" holeDiameter="1.199896mm" shape="circle" />
<silkscreenpath route={[{"x":-2.274315999999999,"y":2.9999939999999867},{"x":2.1999956000000083,"y":2.9999939999999867}]} />
<silkscreenpath route={[{"x":2.999994000000001,"y":1.044473399999987},{"x":2.999994000000001,"y":-1.044473400000001}]} />
<silkscreenpath route={[{"x":-2.999994000000001,"y":1.044473399999987},{"x":-2.999994000000001,"y":-1.044473400000001}]} />
<silkscreenpath route={[{"x":-2.274315999999999,"y":-2.999994000000001},{"x":2.274315999999999,"y":-2.999994000000001}]} />
<silkscreencircle pcbX="-0.04572mm" pcbY="0.04826mm" radius="0.7493mm" />
<silkscreencircle pcbX="-0.04572mm" pcbY="0.04826mm" radius="1.75006mm" />
<silkscreentext text="{NAME}" pcbX="0.0127mm" pcbY="4.302mm" anchorAlignment="center" fontSize="1mm" />
<courtyardoutline outline={[{"x":-4.499928000000011,"y":3.499929999999992},{"x":4.499927999999997,"y":3.499929999999992},{"x":4.499927999999997,"y":-3.499930000000006},{"x":-4.499928000000011,"y":-3.499930000000006},{"x":-4.499928000000011,"y":3.499929999999992}]} />
      </footprint>}
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C589907.obj?uuid=3fb2e0206e424c538e18916c97182b73",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C589907.step?uuid=3fb2e0206e424c538e18916c97182b73",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0, z: -0.000005999999999950489 },
      }}
      {...restProps}
    />
  )
}