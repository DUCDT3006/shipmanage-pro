$files = Get-ChildItem -Filter "Copy of THEO D*I D*U 2026.xlsx"
$filePath = $files[0].FullName
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open($filePath)
$sheet = $workbook.Sheets.Item("VG09")

if ($sheet) {
    Write-Host "--- Inspecting Rows 1-10 in VG09 ---"
    for ($r = 1; $r -le 10; $r++) {
        $rowText = "R" + $r + ": "
        for ($c = 1; $c -le 20; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            $rowText += "(" + $c + ")[" + $val + "] | "
        }
        Write-Host $rowText
    }
}
$workbook.Close($false)
$excel.Quit()
