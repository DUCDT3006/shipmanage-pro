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
        
        $vesselId = if ($sheetName -like "VG05*") { "VG05" } else { "VG09" }
        $currentVoyageNo = ""
        $lastVoyageId = ""
        
        for ($r = 6; $r -le 1000; $r++) {
            $voyageNo = $sheet.Cells.Item($r, 2).Text
            $cargo = $sheet.Cells.Item($r, 3).Text
            $startPos = $sheet.Cells.Item($r, 5).Text
            
            if (-not $voyageNo -and -not $cargo -and -not $startPos) {
                 # Skip if all key columns empty
                 continue
            }

            if ($voyageNo) {
                $currentVoyageNo = $voyageNo
                $fullVoyageId = "FV-$vesselId-$currentVoyageNo"
                
                # Create voyage if new
                $exists = $results.fuelVoyages | Where-Object { $_.id -eq $fullVoyageId }
                if (-not $exists) {
                    $addedFuel = $sheet.Cells.Item($r, 11).Text -replace '[^0-9]', ''
                    $initialFuel = $sheet.Cells.Item($r, 16).Text -replace '[^0-9]', ''
                    
                    $results.fuelVoyages += @{
                        id = $fullVoyageId
                        vesselId = $vesselId
                        voyageNo = $currentVoyageNo
                        cargoType = $cargo
                        addedFuel = if ($addedFuel) { [int]$addedFuel } else { 0 }
                        initialFuel = if ($initialFuel) { [int]$initialFuel } else { 0 }
                        fuelDate = $sheet.Cells.Item($r, 12).Text
                        fuelVendor = $sheet.Cells.Item($r, 14).Text
                        fuelLocation = $sheet.Cells.Item($r, 13).Text
                        fuelUnitPrice = $sheet.Cells.Item($r, 15).Text -replace '[^0-9]', ''
                    }
                }
                $lastVoyageId = $fullVoyageId
            }
            
            if ($startPos -and $lastVoyageId) {
                $startDate = $sheet.Cells.Item($r, 6).Text
                $startTime = $sheet.Cells.Item($r, 7).Text
                $endPos = $sheet.Cells.Item($r, 8).Text
                $endDate = $sheet.Cells.Item($r, 9).Text
                $endTime = $sheet.Cells.Item($r, 10).Text
                $hoursStr = $sheet.Cells.Item($r, 17).Text
                $rateStr = $sheet.Cells.Item($r, 18).Text -replace '[^0-9.]', ''
                
                $results.fuelLogs += @{
                    id = "FL-" + [Guid]::NewGuid().ToString().Substring(0,8)
                    fuelVoyageId = $lastVoyageId
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
    
    $results | ConvertTo-Json -Depth 10 | Out-File "fuel_data_full_v2.json" -Encoding utf8
} finally {
    $workbook.Close($false)
    $excel.Quit()
}
