$data = Get-Content "fuel_data_vg05_vg09.json" -Raw -Encoding utf8 | ConvertFrom-Json

$jsVoyages = "    fuelVoyages: [`n"
foreach ($v in $data.fuelVoyages) {
    $jsVoyages += "        { id: '$($v.id)', vesselId: '$($v.vesselId)', voyageNo: '$($v.voyageNo)', cargoType: '$($v.cargoType)', addedFuel: $($v.addedFuel), initialFuel: $($v.initialFuel), fuelDate: '$($v.fuelDate)', fuelVendor: '$($v.fuelVendor)', fuelLocation: '$($v.fuelLocation)', fuelUnitPrice: $($v.fuelUnitPrice) },`n"
}
$jsVoyages += "    ],"

$jsLogs = "    fuelLogs: [`n"
foreach ($l in $data.fuelLogs) {
    $jsLogs += "        { id: '$($l.id)', fuelVoyageId: '$($l.fuelVoyageId)', startTime: '$($l.startTime)', startPos: '$($l.startPos)', endTime: '$($l.endTime)', endPos: '$($l.endPos)', hours: $($l.hours), fuelRate: $($l.fuelRate) },`n"
}
$jsLogs += "    ],"

$jsVoyages | Out-File "fuel_js_voyages_v5.txt" -Encoding utf8
$jsLogs | Out-File "fuel_js_logs_v5.txt" -Encoding utf8
