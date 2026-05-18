$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $file = Get-ChildItem 'd:\01.VU GIA TAM\1.TAI CHINH\Antigravity\ShipManage\Copy of*.xlsx' | Select-Object -First 1
    if (-not $file) {
        Write-Host "File not found."
        return
    }
    Write-Host "Opening: $($file.FullName)"
    $workbook = $excel.Workbooks.Open($file.FullName)
    $sheet = $null
    foreach ($s in $workbook.Sheets) {
        if ($s.Name -like "VG05*") {
            $sheet = $s
            break
        }
    }

    if ($sheet) {
        Write-Host "Found Sheet: $($sheet.Name)"
        # Scan first 5 rows for header strings
        for ($r = 1; $r -le 10; $r++) {
            for ($c = 1; $c -le 25; $c++) {
                $txt = $sheet.Cells.Item($r, $c).Text
                if ($txt -like "*Nhiên liệu tiêu thụ trung bình*") {
                     Write-Host "MATCH FOUND at Row $r Col $c : $txt"
                }
                if ($txt -like "*tiêu thụ*") {
                     Write-Host "Partial match at Row $r Col $c : $txt"
                }
            }
        }
        
        Write-Host "--- Header Row 4 & 5 ---"
        for ($c = 1; $c -le 25; $c++) {
            $h4 = $sheet.Cells.Item(4, $c).Text
            $h5 = $sheet.Cells.Item(5, $c).Text
            Write-Host "Col $c : H4='$h4' | H5='$h5'"
        }
        
        Write-Host "--- Data Row 6 ---"
        for ($c = 1; $c -le 25; $c++) {
            $d6 = $sheet.Cells.Item(6, $c).Text
            Write-Host "Col $c : D6='$d6'"
        }
    }
    $workbook.Close($false)
} finally {
    $excel.Quit()
}
