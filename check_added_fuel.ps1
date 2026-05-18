$data = Get-Content "fuel_data_full_v2.json" -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Voyages with added fuel (from JSON):"
$data.fuelVoyages | Where-Object { $_.addedFuel -gt 0 } | ForEach-Object {
    Write-Host "Vessel: $($_.vesselId), Voyage: $($_.voyageNo), Added: $($_.addedFuel), Vendor: $($_.fuelVendor)"
}
