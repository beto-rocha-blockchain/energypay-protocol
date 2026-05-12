use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct SettlementResult {
    pub gross_amount: f64,
    pub platform_fee: f64,
    pub net_amount: f64,
}

#[wasm_bindgen]
pub fn execute_settlement(
    amount_kwh: f64,
    price_per_kwh: f64,
) -> JsValue {

    let gross_amount = amount_kwh * price_per_kwh;

    let platform_fee = gross_amount * 0.015;

    let net_amount = gross_amount - platform_fee;

    let result = SettlementResult {
        gross_amount,
        platform_fee,
        net_amount,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}