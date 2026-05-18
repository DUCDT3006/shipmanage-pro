$raw = Get-Content -Path "extracted_data.txt" -Encoding utf8
$results = "["
foreach ($line in $raw) {
    if ($line.Trim() -eq "") { continue }
    $parts = $line.Split("|")
    if ($parts.Length -lt 8) { continue }
    
    $date = $parts[0]
    $vessel = $parts[1]
    $cat = $parts[2]
    $content = $parts[3]
    $thu = $parts[4].Replace(",", "").Trim()
    if ($thu -eq "") { $thu = 0 }
    $chi = $parts[5].Replace(",", "").Trim()
    if ($chi -eq "") { $chi = 0 }
    $acc = $parts[6].Trim()
    $partner = $parts[7].Trim()
    
    $dateParts = $date.Split("/")
    if ($dateParts.Length -lt 3) { continue }
    $formattedDate = "{0}-{1:D2}-{2:D2}" -f $dateParts[2], [int]$dateParts[1], [int]$dateParts[0]
    
    $account = "Tiền mặt"
    if ($acc -like "*AB*") { $account = "ABbank" }
    elseif ($acc -like "*VT*") { $account = "Viettinbank" }
    elseif ($acc -like "*CN*") { $account = "Tài khoản cá nhân" }
    
    if ($vessel -eq "VP" -or $vessel -eq "") { $vessel = "Công ty" }
    
    # Escape quotes for JSON
    $escContent = $content.Replace('"', '\"')
    $escPartner = $partner.Replace('"', '\"')
    $escCat = $cat.Replace('"', '\"')
    
    $jsonObj = "{`"id`": `"TX$([guid]::NewGuid())`", `"date`": `"$formattedDate`", `"vessel`": `"$vessel`", `"category`": `"$escCat`", `"partner`": `"$escPartner`", `"content`": `"$escContent`", `"thu`": $thu, `"chi`": $chi, `"account`": `"$account`"}"
    $results += $jsonObj + ","
}
$results = $results.TrimEnd(",") + "]"
$results | Out-File -FilePath "transactions.json" -Encoding utf8
