$files = Get-ChildItem -Filter "Copy of THEO D*I D*U 2026.xlsx"
$filePath = $files[0].FullName
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)
$sheet = $workbook.Sheets.Item("VG18.")

if ($sheet) {
    Write-Host "--- Inspecting Rows in VG18. ---"
    for ($r = 8; $r -le 15; $r++) {
        $rowText = "R" + $r + ": "
        for ($c = 1; $c -le 25; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            $rowText += "(" + $c + ")[" + $val + "] | "
        }
        Write-Host $rowText
    }
} else {
    Write-Host "Sheet VG18. not found"
}

$workbook.Close($false)
$excel.Quit()
