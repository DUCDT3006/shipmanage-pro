$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\03.Theo doi tai chinh.xlsx')
$sheet = $workbook.Sheets.Item('Thu-Chi')
$range = $sheet.UsedRange
$rows = $range.Rows.Count

$results = @()

for ($i = 2; $i -le $rows; $i++) {
    $dateStr = $sheet.Cells.Item($i, 1).Text
    if ($dateStr -match '/4/2026' -or $dateStr -match '/5/2026' -or $dateStr -match '/04/2026' -or $dateStr -match '/05/2026') {
        $vessel = $sheet.Cells.Item($i, 2).Text
        $cat = $sheet.Cells.Item($i, 3).Text
        $content = $sheet.Cells.Item($i, 4).Text
        $thu = $sheet.Cells.Item($i, 5).Text
        $chi = $sheet.Cells.Item($i, 6).Text
        $acc = $sheet.Cells.Item($i, 7).Text
        $partner = $sheet.Cells.Item($i, 8).Text
        
        $results += "$dateStr|$vessel|$cat|$content|$thu|$chi|$acc|$partner"
    }
}

$results | Out-File -FilePath "extracted_data.txt" -Encoding utf8
$workbook.Close($false)
$excel.Quit()
