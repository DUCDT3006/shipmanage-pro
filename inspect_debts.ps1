$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $workbook = $excel.Workbooks.Open('d:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\03.Theo doi tai chinh.xlsx')
    $sheet = $workbook.Sheets.Item('THEO DOI CONG NO')
    $out = @()
    $out += "--- THEO DOI CONG NO SHEET ---"
    for ($r = 1; $r -le 300; $r++) {
        $rowText = "Row $($r): "
        $hasVal = $false
        for ($c = 1; $c -le 15; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            if ($val -and $val.Trim() -ne '') {
                $hasVal = $true
            }
            $rowText += "($c)[$val] | "
        }
        if ($hasVal) {
            $out += $rowText
        }
    }
    $out | Out-File -FilePath "debts_sheet.txt" -Encoding utf8
} finally {
    if ($workbook) { $workbook.Close($false) }
    $excel.Quit()
}
