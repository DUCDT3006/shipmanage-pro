$files = Get-ChildItem -Filter "Copy of THEO D*I D*U 2026.xlsx"
if ($files.Count -eq 0) { Write-Host "File not found!"; exit }
$filePath = $files[0].FullName

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)

$sheet = $null
foreach ($s in $workbook.Sheets) {
    if ($s.Name -like "VG 05*") { $sheet = $s; break }
}

if ($sheet) {
    Write-Host "--- Inspecting Row 8-15 ---"
    for ($r = 8; $r -le 15; $r++) {
        $rowText = ""
        for ($c = 1; $c -le 20; $c++) {
            $rowText += "Col $c: [$($sheet.Cells.Item($r, $c).Text)] | "
        }
        Write-Host "$rowText"
    }
} else {
    Write-Host "Sheet not found"
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
