$files = Get-ChildItem -Filter "Copy of THEO D*I D*U 2026.xlsx"
$filePath = $files[0].FullName
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)
$sheet = $workbook.Sheets.Item("VG05.")

if ($sheet) {
    Write-Host "--- Inspecting Rows in VG05. ---"
    for ($r = 8; $r -le 25; $r++) {
        $rowText = "R" + $r + ": "
        for ($c = 1; $c -le 20; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            $rowText += "(" + $c + ")[" + $val + "] | "
        }
        Write-Host $rowText
    }
} else {
    Write-Host "Sheet VG05. not found"
}

$workbook.Close($false)
$excel.Quit()
