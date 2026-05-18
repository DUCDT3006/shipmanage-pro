$data = Get-Content "fuel_data_vg15_vg18_vg36.json" -Raw -Encoding utf8 | ConvertFrom-Json

$jsVoyages = ""
foreach ($v in $data.fuelVoyages) {
    $jsVoyages += "        { id: '$($v.id)', vesselId: '$($v.vesselId)', voyageNo: '$($v.voyageNo)', cargoType: '$($v.cargoType)', addedFuel: $($v.addedFuel), initialFuel: $($v.initialFuel), fuelDate: '$($v.fuelDate)', fuelVendor: '$($v.fuelVendor)', fuelLocation: '$($v.fuelLocation)', fuelUnitPrice: $($v.fuelUnitPrice) },`n"
}

$jsLogs = ""
foreach ($l in $data.fuelLogs) {
    $jsLogs += "        { id: '$($l.id)', fuelVoyageId: '$($l.fuelVoyageId)', startTime: '$($l.startTime)', startPos: '$($l.startPos)', endTime: '$($l.endTime)', endPos: '$($l.endPos)', hours: $($l.hours), fuelRate: $($l.fuelRate) },`n"
}

$jsVoyages | Out-File "fuel_js_voyages_vg15.txt" -Encoding utf8
$jsLogs | Out-File "fuel_js_logs_vg15.txt" -Encoding utf8
