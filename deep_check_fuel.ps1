$filePath = 'd:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\Copy of THEO DÕI DẦU 2026.xlsx'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)

function Extract-Fuel($sheetName, $vesselId) {
    $sheet = $workbook.Sheets.Item($sheetName)
    $rows = $sheet.UsedRange.Rows.Count
    Write-Host "--- Fuel Additions for $vesselId ($sheetName) ---"
    for ($r = 8; $r -le $rows; $r++) {
        $voyage = $sheet.Cells.Item($r, 1).Text
        $added = $sheet.Cells.Item($r, 4).Value
        if ($added -gt 0) {
            $date = $sheet.Cells.Item($r, 5).Text
            $vendor = $sheet.Cells.Item($r, 6).Text
            $loc = $sheet.Cells.Item($r, 7).Text
            $price = $sheet.Cells.Item($r, 11).Value
            Write-Host "Row $r | Voyage: $voyage | Added: $added | Date: $date | Vendor: $vendor | Loc: $loc | Price: $price"
        }
    }
}

Extract-Fuel 'VG 05' 'VG05'
Extract-Fuel 'VG 09' 'VG09'

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
