let ws = null;
let statusTimeout = null;
const voltageBuffer = [];
const batteryTempBuffer = [];
const externalTempBuffer = [];
const voltageLabels = [];
const tempLabels = [];

export function startWebSocket(onSOCUpdate, onTempUpdate, onVoltageUpdate) {
    ws = new WebSocket("ws://hoonservice.iptime.org:12261");

        ws.onopen = () => {
        // Update 서버 상태 span
        const serverStatusElem = document.querySelectorAll("p span")[0];
        if (serverStatusElem) {
            serverStatusElem.textContent = "연결됨";
            serverStatusElem.style.color = "green";
        }
    };

    ws.onclose = () => {
        // Update 서버 상태 span
        const serverStatusElem = document.querySelectorAll("p span")[0];
        if (serverStatusElem) {
            serverStatusElem.textContent = "연결 안됨";
            serverStatusElem.style.color = "red";
        }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === "status" && data.device === "esp32" && data.status === "live") {
                const statusElem = document.querySelectorAll("p span")[1];
                if (statusElem) {
                    statusElem.textContent = "연결됨";
                    statusElem.style.color = "green";
                }
                clearTimeout(statusTimeout);
                statusTimeout = setTimeout(() => {
                    if (statusElem) {
                        statusElem.textContent = "연결안됨";
                        statusElem.style.color = "red";
                    }
                }, 2000);
                return;
            }

            if (data.type === "CAN") {
                if (data.id == 1574) {
                    const soc = data.data[0];
                    const soh = data.data[5];
                    onSOCUpdate(soc, soh);
                }

                if (data.id == 1575) {
                    const batteryTemp = data.data[0];
                    const externalTemp = data.data[1];
                    batteryTempBuffer.push(batteryTemp);
                    if (batteryTempBuffer.length > 30) batteryTempBuffer.shift();
                    externalTempBuffer.push(externalTemp);
                    if (externalTempBuffer.length > 30) externalTempBuffer.shift();
                    // Generate timestamp label
                    const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
                    tempLabels.push(now);
                    if (tempLabels.length > 30) tempLabels.shift();
                    onTempUpdate(batteryTempBuffer, externalTempBuffer, tempLabels);
                    // Update temperature summary in DOM
                    const tempSummaryElem = document.querySelector("#temperature-summary");
                    if (tempSummaryElem) {
                        tempSummaryElem.style.fontSize = "20px";
                        tempSummaryElem.style.textAlign = "center";
                        tempSummaryElem.style.margin = "20px 0";
                        tempSummaryElem.textContent = `배터리: ${batteryTemp}°C 외부: ${externalTemp}°C`;
                    }
                }

                if (data.id == 1576) {
                    const voltage = data.data[0];
                    voltageBuffer.push(voltage);
                    if (voltageBuffer.length > 30) voltageBuffer.shift();
                    // Generate timestamp label
                    const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
                    voltageLabels.push(now);
                    if (voltageLabels.length > 30) voltageLabels.shift();
                    onVoltageUpdate(voltageBuffer, voltageLabels);
                }

                if (data.id == 1570) {
                    const chargingStatus = data.data[0]; // Status field
                    const chargingElem = document.getElementById("charging-status");
                    if (chargingElem) {
                        chargingElem.textContent = chargingStatus === 1 ? "충전중" : "충전중 아님";
                    }
                }

                // VIN_car_info: 
                if (data.id == 1569) {
                    const vinBytes = data.data;
                    const vin = vinBytes.map(b => String.fromCharCode(b)).join('').replace(/\0/g, '');
                    const vinElem = document.querySelector("p strong");
                    if (vinElem) vinElem.textContent = vin;
                }

                // BMS_Company_Info: 
                if (data.id == 1568) {
                    const carnameBytes = data.data;
                    const carname = carnameBytes.map(b => String.fromCharCode(b)).join('').replace(/\0/g, '');
                    const carElem = document.querySelectorAll("p strong")[1];
                    if (carElem) carElem.textContent = carname;
                }
            }

            if (data.type === "alert" && data.act === "emergencystop") {
                const emergencyModal = document.getElementById("emergencyStopModal");
                if (emergencyModal) {
                    emergencyModal.style.display = "block";
                }
                if (window.chargeTimer) clearInterval(window.chargeTimer);
                sendStopChargeCommand(); // Send STOP_CHARGE on emergency
                const timeElem = document.getElementById("remaining-time");
                if (timeElem) timeElem.textContent = "(충전시간 설정안됨)";
            }
        } catch (err) {
            console.error("WebSocket message error:", err);
        }
    };
}

export function sendStartChargeCommand() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CMD", act: "START_CHARGE", error: "none" }));
    } else {
        console.warn("WebSocket is not open. Cannot send START_CHARGE.");
    }
}

export function sendStopChargeCommand() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CMD", act: "STOP_CHARGE", error: "none" }));
    } else {
        console.warn("WebSocket is not open. Cannot send STOP_CHARGE.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("closeEmergencyModal");
    const modal = document.getElementById("emergencyStopModal");
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            if (chargeTimer) clearInterval(chargeTimer);
            modal.style.display = "none";
        });
    }
});

// BO_ 1568 BMS_Company_Info: 8 BMS
//  SG_ CompanyName : 0|64@1+ (1,0) [0|0] "" BMS

// BO_ 1569 VIN_car_info: 8 BMS
//  SG_ Carname : 0|64@1+ (1,0) [0|0] "" BMS

// BO_ 1570 BMS_Status: 6 BMS
//  SG_ Status : 0|8@1+ (1,0) [0|0] "" BMS
//  SG_ Time : 8|16@1+ (1,0) [0|60] "s" BMS
//  SG_ Flags : 24|8@1+ (1,0) [0|128] "" BMS
//  SG_ DTC1 : 32|8@1+ (1,0) [0|128] "" BMS
//  SG_ DTC2 : 40|8@1+ (1,0) [0|128] "" BMS

// BO_ 1571 BMS_Battery_Info: 6 BMS
//  SG_ Voltage : 0|16@1+ (1,0) [0|65536] "V" BMS
//  SG_ MinVoltage : 16|8@1+ (0.1,0) [0|25.4] "V" BMS
//  SG_ MinVoltageID : 24|8@1+ (1,0) [0|254] "" BMS
//  SG_ MaxVoltage : 32|8@1+ (0.1,0) [0|25.4] "V" BMS
//  SG_ MaxVoltageID : 40|8@1+ (1,0) [0|254] "" BMS

// BO_ 1572 BMS_Charge_Current_Limits: 6 BMS
//  SG_ Current : 0|16@1- (1,0) [-32000|32000] "A" BMS
//  SG_ ChargeLimit : 16|16@1+ (1,0) [0|32000]  "A" BMS
//  SG_ DischargeLimit : 32|16@1+ (1,0) [0|32000] "A" BMS

// BO_ 1574 BMS_SOC: 6 BMS
//  SG_ SOC :  0|8@1+ (1,0) [0|100] "%" BMS
//  SG_ DOD : 8|16@1+ (1,0) [0|65536] "Ah" BMS
//  SG_ Capacity : 24|16@1+ (1,0) [0|65536] "Ah" BMS
//  SG_ SOH : 40|8@1+ (1,0) [0|100] "%" BMS

// BO_ 1575 BMS_Temperature: 6 BMS
//  SG_ Temperature : 0|8@1- (1,0) [-127|127] "°C" BMS
//  SG_ AirTemp : 8|8@1- (1,0) [-127|127] "°C" BMS
//  SG_ MinTemp : 16|8@1- (1,0) [-127|127] "°C" BMS
//  SG_ MinTempID : 24|8@1+ (1,0) [0|254] "" BMS
//  SG_ MaxTemp : 32|8@1- (1,0) [-127|127] "°C" BMS
//  SG_ MaxTempID : 40|8@1+ (1,0) [0|254] "" BMS


// BO_ 1576 BMS_Resistance: 6 BMS
//  SG_ Resistance : 0|16@1+ (1,0) [0|65536] "Ω" BMS
//  SG_ MinResistance : 16|8@1+ (0.1,0) [0|254]"mΩ" BMS
//  SG_ MinResistanceID : 24|8@1+ (1,0) [0|254] "" BMS
//  SG_ MaxResistance : 32|8@1+ (0.1,0) [0|254] "mΩ" BMS
//  SG_ MaxResistanceID : 40|8@1+ (1,0) [0|254] "" BMS

// BO_ 1577 BMS_DC_Charging: 8 BMS
//  SG_ DCLineVoltage : 0|16@1+ (1,0) [0|65536] "V" BMS
//  SG_ DCLineCurrent : 16|16@1+ (1,0) [0|127] "A" BMS
//  SG_ MaxChargeCurrent : 32|8@1+ (1,0) [0|255] "A" BMS
//  SG_ MaxDischargeCurrent : 40|8@1+ (1,0) [0|255] "A" BMS
//  SG_ DCLinePower : 48|16@1+ (1,0) [0|32768] "W" BMS
