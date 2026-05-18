$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $file = Get-ChildItem 'd:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\Copy of*.xlsx' | Select-Object -First 1
    if (-not $file) { return }
    $workbook = $excel.Workbooks.Open($file.FullName)
    
    $results = @{
        fuelVoyages = @()
        fuelLogs = @()
    }

    # ONLY process VG05 and VG09 as they have the same structure and are the focus
    $sheetsToProcess = @("VG05.", "VG09")
    
    foreach ($sheetName in $sheetsToProcess) {
        $sheet = $null
        foreach ($s in $workbook.Sheets) {
            if ($s.Name -eq $sheetName) {
                $sheet = $s
                break
            }
        }
        if (-not $sheet) { continue }
        
        $vesselId = $sheetName -replace '\.', ''
        $currentVoyage = $null
        
        for ($r = 8; $r -le 1000; $r++) {
            $voyageNo = $sheet.Cells.Item($r, 2).Text
            $cargo = $sheet.Cells.Item($r, 3).Text
            $startPos = $sheet.Cells.Item($r, 5).Text
            
            if (-not $voyageNo -and -not $cargo -and -not $startPos) {
                 continue
            }

            if ($voyageNo) {
                # New voyage start
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
                
                # Initial fuel is in Col 16
                $initStr = $sheet.Cells.Item($r, 16).Text -replace '[^0-9]', ''
                if ($initStr) { $currentVoyage.initialFuel = [int]$initStr }
                
                $results.fuelVoyages += $currentVoyage
            }
            
            if ($currentVoyage) {
                # Check for added fuel on ANY row of the voyage (Col 11)
                $addedStr = $sheet.Cells.Item($r, 11).Text -replace '[^0-9]', ''
                if ($addedStr -and [int]$addedStr -gt 0) {
                    $currentVoyage.addedFuel = [int]$addedStr
                    $currentVoyage.fuelDate = $sheet.Cells.Item($r, 12).Text
                    $currentVoyage.fuelLocation = $sheet.Cells.Item($r, 13).Text
                    $currentVoyage.fuelVendor = $sheet.Cells.Item($r, 14).Text
                    $unitPriceStr = $sheet.Cells.Item($r, 15).Text -replace '[^0-9]', ''
                    if ($unitPriceStr) { $currentVoyage.fuelUnitPrice = [int]$unitPriceStr }
                }
            }
            
            if ($startPos -and $currentVoyage) {
                $startDate = $sheet.Cells.Item($r, 6).Text
                $startTime = $sheet.Cells.Item($r, 7).Text
                $endPos = $sheet.Cells.Item($r, 8).Text
                $endDate = $sheet.Cells.Item($r, 9).Text
                $endTime = $sheet.Cells.Item($r, 10).Text
                $hoursStr = $sheet.Cells.Item($r, 17).Text
                $rateStr = $sheet.Cells.Item($r, 18).Text -replace '[^0-9.]', ''
                
                $results.fuelLogs += @{
                    id = "FL-" + [Guid]::NewGuid().ToString().Substring(0,8)
                    fuelVoyageId = $currentVoyage.id
                    startTime = "$startDate $startTime"
                    startPos = $startPos
                    endTime = "$endDate $endTime"
                    endPos = $endPos
                    hours = if ($hoursStr) { [double]$hoursStr } else { 0 }
                    fuelRate = if ($rateStr) { [double]$rateStr } else { 0 }
                }
            }
        }
    }
    
    $results | ConvertTo-Json -Depth 10 | Out-File "fuel_data_vg05_vg09.json" -Encoding utf8
} finally {
    $workbook.Close($false)
    $excel.Quit()
}
