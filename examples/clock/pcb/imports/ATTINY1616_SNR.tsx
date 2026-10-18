import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["VDD"],
  pin2: ["PA4"],
  pin3: ["PA5"],
  pin4: ["PA6"],
  pin5: ["PA7"],
  pin6: ["PB5"],
  pin7: ["PB4"],
  pin8: ["TOSC1","PB3"],
  pin9: ["TOSC2","PB2"],
  pin10: ["PB1"],
  pin11: ["PB0"],
  pin12: ["PC0"],
  pin13: ["PC1"],
  pin14: ["PC2"],
  pin15: ["PC3"],
  pin16: ["PA0","N_RESET","UPDI"],
  pin17: ["PA1"],
  pin18: ["PA2"],
  pin19: ["PA3","EXTCLK"],
  pin20: ["GND"]
} as const

const pinAttributes = {
  pin1: {requiresPower: true, mustBeConnected: true, shouldHaveDecouplingCapacitor: true},
  pin20: {requiresGround: true, mustBeConnected: true},
  pin11: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["i2c_scl"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin12: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_sck"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin13: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_miso"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin14: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_mosi"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin15: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_cs"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin16: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin17: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["uart_tx","spi_mosi","i2c_sda"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin18: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["uart_rx","spi_miso","i2c_scl"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin19: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_sck"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin10: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["i2c_sda"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin9: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["uart_tx"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin8: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["uart_rx"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin7: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin6: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin5: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin4: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin3: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, canUseInternalPullup: true, canUsePushPull: true, isGpio: true},
  pin2: {isInput: true, isOutput: true, isBidirectional: true, canUseTriState: true, capabilities: ["spi_cs"], canUseInternalPullup: true, canUsePushPull: true, isGpio: true}
} satisfies NonNullable<ChipProps["pinAttributes"]>

export const ATTINY1616_SNR = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      pinAttributes={pinAttributes}
      supplierPartNumbers={{
  "jlcpcb": [
    "C609652"
  ]
}}
      manufacturerPartNumber="ATTINY1616-SNR"
      footprint="soic20_pillpads_w11.7mm_pl2.3mm_pin1location(leftside,bottom)"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C609652.obj?uuid=f802a94fc95e42bebc73c20bec55bb23",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C609652.step?uuid=f802a94fc95e42bebc73c20bec55bb23",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0.000012699999956566899, z: -1.35 },
      }}
      {...props}
    />
  )
}