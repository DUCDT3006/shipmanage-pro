[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$data = Get-Content "fuel_data_full_v2.json" -Raw -Encoding utf8 | ConvertFrom-Json

Write-Host "--- fuelVoyages JS ---"
foreach ($v in $data.fuelVoyages) {
    $added = if ($v.addedFuel) { $v.addedFuel } else { 0 }
    $initial = if ($v.initialFuel) { $v.initialFuel } else { 0 }
    $price = if ($v.fuelUnitPrice) { $v.fuelUnitPrice } else { 0 }
    "        { id: '$($v.id)', vesselId: '$($v.vesselId)', voyageNo: '$($v.voyageNo)', cargoType: '$($v.cargoType)', addedFuel: $added, initialFuel: $initial, fuelDate: '$($v.fuelDate)', fuelVendor: '$($v.fuelVendor)', fuelLocation: '$($v.fuelLocation)', fuelUnitPrice: $price },"
}

Write-Host "`n--- fuelLogs JS ---"
foreach ($l in $data.fuelLogs) {
    $hours = [math]::Round($l.hours, 2)
    if ($hours -lt 0 -or $hours -gt 1000) { $hours = 0 }
    "        { id: '$($l.id)', fuelVoyageId: '$($l.fuelVoyageId)', startTime: '$($l.startTime)', startPos: '$($l.startPos)', endTime: '$($l.endTime)', endPos: '$($l.endPos)', hours: $hours, fuelRate: $($l.fuelRate) },"
}
