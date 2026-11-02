#!/usr/bin/env bash
# 發布單一來源的 JSON：先提交，再同步遠端，避免多個排程互相覆蓋。
# 此腳本由 Actions 呼叫；工作目錄應為 checkout 後的專案根目錄。
# 任一指令失敗、使用未定義變數或管線出錯時，立刻以失敗狀態結束。
set -euo pipefail

# 僅接受已知來源名稱，避免參數被用來組成任意檔案路徑。
source_name="${1:-}"
case "$source_name" in bbc|google|komica|ptt) ;; *) echo "Unknown source: $source_name" >&2; exit 1 ;; esac
file="data/${source_name}-trends.json"
[[ -f "$file" ]] || { echo "Missing $file" >&2; exit 1; }

# 身分設定只作用於目前倉庫；只加入本次來源的 JSON，不提交其他檔案。
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- "$file"
# 沒有資料差異就成功結束，不建立空提交。
if git diff --cached --quiet; then exit 0; fi
git commit -m "update ${source_name} trends [CI] $(TZ=Asia/Taipei date '+%Y-%m-%d %H:%M:%S')"

# 呼叫端已將相同來源的排程序列化，不同來源則更新不同檔案。
# 先提交爬取結果再 rebase，避免未提交的 JSON 讓同步失敗；也能保留其他來源的新資料。
for attempt in 1 2 3 4 5; do
    git pull --rebase origin main
    # 若同步後又有其他排程先推送，就在下一輪重新同步，最多嘗試五次。
    if git push origin HEAD:main; then exit 0; fi
    if [[ "$attempt" -lt 5 ]]; then sleep "$attempt"; fi
done
# 五次仍無法發布時，明確回報失敗，讓 Actions 顯示問題而不是誤判成功。
echo 'Could not publish after 5 attempts' >&2
exit 1
