$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $file = Get-ChildItem 'd:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\Copy of*.xlsx' | Select-Object -First 1
    if (-not $file) { Write-Host "No file found."; return }
    $workbook = $excel.Workbooks.Open($file.FullName)
    
    $results = @{
        fuelVoyages = @()
        fuelLogs = @()
    }

    $sheetsToProcess = @("VG15", "VG18", "VG36")
    
    foreach ($sheetName in $sheetsToProcess) {
        $sheet = $null
        foreach ($s in $workbook.Sheets) {
            if ($s.Name -eq $sheetName) { $sheet = $s; break }
        }
        if (-not $sheet) { continue }
        
        $vesselId = $sheetName -replace '\.', ''
        $currentVoyage = $null
        
        for ($r = 6; $r -le 1000; $r++) {
            $voyageNo = $sheet.Cells.Item($r, 2).Text
            $cargo = $sheet.Cells.Item($r, 3).Text
            $startPos = $sheet.Cells.Item($r, 5).Text
            
            if (-not $voyageNo -and -not $cargo -and -not $startPos) { continue }

            if ($voyageNo) {
                $fullVoyageId = "FV-$vesselId-$voyageNo"
                $currentVoyage = @{
                    id = $fullVoyageId
                    vesselId = $vesselId
                    voyageNo = $voyageNo
                    cargoType = $cargo
                    addedFuel = 0
                    initialFuel = 0
                    fuelDate = ""
                    fuelVendor = ""
                    fuelLocation = ""
                    fuelUnitPrice = 0
                }
                
                $initStr = $sheet.Cells.Item($r, 16).Text -replace '[^0-9]', ''
                if ($initStr) { $currentVoyage.initialFuel = [int]$initStr }
                
                $results.fuelVoyages += $currentVoyage
            }
            
            if ($currentVoyage) {
                $addedStr = $sheet.Cells.Item($r, 11).Text -replace '[^0-9]', ''
                if ($addedStr -and [int]$addedStr -gt 0) {
                    $currentVoyage.addedFuel += [int]$addedStr # Combine if multiple additions in a voyage
                    # In this approach, if there are multiple additions, it just takes the last vendor/date/location/price.
                    # Or maybe I should just use the first valid one? Let's assume only one or sum them and keep last text details.
                    
                    # Update details with the latest non-empty if they exist
                    $fDate = $sheet.Cells.Item($r, 12).Text
                    if ($fDate) { $currentVoyage.fuelDate = $fDate }
                    
                    $fLoc = $sheet.Cells.Item($r, 13).Text
                    if ($fLoc) { $currentVoyage.fuelLocation = $fLoc }
                    
                    $fVend = $sheet.Cells.Item($r, 14).Text
                    if ($fVend) { $currentVoyage.fuelVendor = $fVend }
                    
                    $upStr = $sheet.Cells.Item($r, 15).Text -replace '[^0-9]', ''
                    if ($upStr) { $currentVoyage.fuelUnitPrice = [int]$upStr }
                }
            }
            
            if ($startPos -and $currentVoyage) {
                $sd = $sheet.Cells.Item($r, 6).Text
                $st = $sheet.Cells.Item($r, 7).Text
                $ed = $sheet.Cells.Item($r, 9).Text
                $et = $sheet.Cells.Item($r, 10).Text
                $ep = $sheet.Cells.Item($r, 8).Text
                $hStr = $sheet.Cells.Item($r, 17).Text
                $rStr = $sheet.Cells.Item($r, 18).Text -replace '[^0-9.]', ''
                
                $hours = 0
                if ($hStr -and $hStr -notmatch '^\s*$') {
                    try { $hours = [double]$hStr } catch { $hours = 0 }
                }
                # Sanity check for negative hours (due to empty end time)
                if ($hours -lt 0) { $hours = 0 }

                $results.fuelLogs += @{
                    id = "FL-" + [Guid]::NewGuid().ToString().Substring(0,8)
                    fuelVoyageId = $currentVoyage.id
                    startTime = "$sd $st".Trim()
                    startPos = $startPos
                    endTime = "$ed $et".Trim()
                    endPos = $ep
                    hours = $hours
                    fuelRate = if ($rStr) { [double]$rStr } else { 0 }
                }
            }
        }
    }
    
    $results | ConvertTo-Json -Depth 10 | Out-File "fuel_data_vg15_vg18_vg36.json" -Encoding utf8
} finally {
    if ($workbook) { $workbook.Close($false) }
    $excel.Quit()
}
