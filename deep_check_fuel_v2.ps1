$files = Get-ChildItem -Filter "Copy of THEO D*I D*U 2026.xlsx"
if ($files.Count -eq 0) { Write-Host "File not found!"; exit }
$filePath = $files[0].FullName
Write-Host "Opening: $filePath"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)

function Extract-Fuel($sheetName, $vesselId) {
    try {
        $sheet = $workbook.Sheets.Item($sheetName)
        $rows = $sheet.UsedRange.Rows.Count
        Write-Host "`n--- Fuel Additions for $vesselId ($sheetName) ---"
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
    } catch {
        Write-Host "Error in sheet $sheetName"
    }
}

Extract-Fuel 'VG 05' 'VG05'
Extract-Fuel 'VG 09' 'VG09'

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
