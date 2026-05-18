$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $file = Get-ChildItem 'd:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\Copy of*.xlsx' | Select-Object -First 1
    if (-not $file) { Write-Host "No file found."; return }
    $workbook = $excel.Workbooks.Open($file.FullName)
    foreach ($s in $workbook.Sheets) {
        Write-Host "Sheet Name: '$($s.Name)'"
    }
} finally {
    if ($workbook) { $workbook.Close($false) }
    $excel.Quit()
}
