import init, {
  execute_settlement
} from "@/wasm/energy_core";

let initialized = false;

export async function initEnergyCore() {
  if (!initialized) {
    await init();

    initialized = true;

    console.log(
      "EnergyCore WASM initialized"
    );
  }
}

export async function executeSettlement(
  amountKwh: number,
  pricePerKwh: number
) {

  if (!initialized) {
    await initEnergyCore();
  }

  return execute_settlement(
    amountKwh,
    pricePerKwh
  );
}