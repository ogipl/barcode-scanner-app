// script.js

// HTML要素への参照を取得
const currentStateDisplay = document.getElementById('currentStateDisplay');
const storedCodeDisplay = document.getElementById('storedCodeDisplay');
const scannedCodeDisplay = document.getElementById('scannedCodeDisplay');
const checkResultDisplay = document.getElementById('checkResultDisplay'); // 検品結果用
const debugInfoDisplay = document.getElementById('debug-info');

// グローバル変数
let html5QrCode;
let storedStoreCode = null; // 保持する店舗コード
let lastScannedCode = null; // 前回スキャンしたコード (重複防止用)
let scanCooldownActive = false; // クールダウン中のフラグ

// デバッグ情報を表示するためのヘルパー関数
function updateDebugInfo(message, color = 'grey') {
    debugInfoDisplay.textContent = `Debug: ${new Date().toLocaleTimeString()} - ${message}`;
    debugInfoDisplay.style.color = color;
    console.log(`[DEBUG] ${message}`); // コンソールにも出力
}

// =======================================================
// バーコードスキャン開始関数 (html5-qrcode用 - アプリ起動時に一度だけ呼び出す)
// =======================================================
async function startScanner() {
    currentStateDisplay.textContent = 'カメラ起動中...';
    currentStateDisplay.style.color = 'blue';
    updateDebugInfo("Initializing HTML5-QRCode scanner for continuous scanning...", 'blue');

    const qrCodeRegionId = "qr-reader";

    // 既にインスタンスがあれば停止（念のため、もし残っていたら）
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
    }
    html5QrCode = new Html5Qrcode(qrCodeRegionId);

    const qrCodeConfig = {
        fps: 10,
        // qrbox のサイズをさらに小さく調整（例: 120px x 120px）
        qrbox: { width: 120, height: 120 }, // ここを調整
        videoConstraints: {
            facingMode: { exact: "environment" },
            // 解像度は前回動作していたものに戻します
            width: { ideal: 640 },
            height: { ideal: 480 },
        },
    };

    try {
        await html5QrCode.start(
            qrCodeConfig.videoConstraints,
            qrCodeConfig,
            (decodedText, decodedResult) => {
                // スキャン成功時のコールバック
                // クールダウン中でない、かつ前回と同じバーコードでない場合のみ処理
                if (!scanCooldownActive && decodedText !== lastScannedCode) {
                    scanCooldownActive = true; // クールダウン開始
                    lastScannedCode = decodedText; // 前回スキャンしたコードを記録

                    updateDebugInfo(`Barcode detected: ${decodedText}`, 'green');
                    handleBarcodeScan(decodedText);

                    // 処理後、少し待ってからクールダウンを解除し、次のスキャンを受け付ける
                    setTimeout(() => {
                        scanCooldownActive = false;
                        lastScannedCode = null; // クールダウン終了時に前回スキャンコードをリセット
                    }, 1500); // 1.5秒のクールダウン (調整可能)
                } else if (scanCooldownActive) {
                    // クールダウン中の場合はスキャンを無視
                    // updateDebugInfo(`Ignoring scan during cooldown: ${decodedText}`, 'orange'); // デバッグログはうるさくなるのでコメントアウト
                } else if (decodedText === lastScannedCode) {
                    // 同じバーコードが連続して検出された場合は無視
                    // updateDebugInfo(`Ignoring duplicate scan: ${decodedText}`, 'orange'); // デバッグログはうるさくなるのでコメントアウト
                }
            },
            (errorMessage) => {
                // スキャンエラー時のコールバックは通常ログに出さない（大量に出るため）
                // updateDebugInfo(`Scan Error: ${errorMessage}`, 'orange');
            }
        );
        updateDebugInfo("Camera started successfully. Ready to scan continuously.", 'green');
        currentStateDisplay.textContent = '店舗コードをスキャンしてください';
        currentStateDisplay.style.color = 'black'; // 初期の状態メッセージ
        storedCodeDisplay.textContent = 'なし';
        scannedCodeDisplay.textContent = 'なし';
        checkResultDisplay.textContent = '';


    } catch (err) {
        updateDebugInfo(`HTML5-QRCode Start Error: ${err.name || err.message || err.toString()}`, 'red');
        console.error("HTML5-QRCode 起動エラー詳細:", err);

        let errorMessage = "カメラの起動に失敗しました。";
        if (err.name === 'NotAllowedError') {
            errorMessage += " アクセスが拒否されました。ブラウザの許可設定とiPhoneの設定（プライバシー->カメラ）を確認してください。";
        } else if (err.name === 'NotFoundError') {
            errorMessage += " カメラが見つかりませんでした。";
        } else if (err.name === 'NotReadableError') {
            errorMessage += " カメラが使用中です。他のアプリやタブを閉じてください。";
        } else if (err.name === 'OverconstrainedError') {
            errorMessage += " カメラ設定（解像度など）がデバイスでサポートされていません。";
        } else if (err.name === 'AbortError') {
            errorMessage += " カメラアクセスが中断されました。";
        } else {
            errorMessage += ` エラーコード: ${err.name || err.message || '不明'}`;
        }
        currentStateDisplay.textContent = errorMessage;
        currentStateDisplay.style.color = "red";
    }
}

// =======================================================
// バーコードスキャン結果のハンドリング関数 (主要ロジック)
// =======================================================
function handleBarcodeScan(scannedCode) {
    scannedCodeDisplay.textContent = scannedCode; // 今回スキャンしたコードを表示

    if (storedStoreCode === null) {
        // まだ店舗コードが保持されていない場合（最初のスキャン）
        storedStoreCode = scannedCode;
        storedCodeDisplay.textContent = storedStoreCode;
        currentStateDisplay.textContent = '商品バーコードをスキャンしてください';
        currentStateDisplay.style.color = 'blue';
        checkResultDisplay.textContent = ''; // 結果をクリア
        updateDebugInfo(`店舗コードを保持しました: ${storedStoreCode}`, 'green');
        alert(`店舗コードを保存しました: ${storedStoreCode}\n次に商品バーコードをスキャンしてください。`);

    } else {
        // 店舗コードが既に保持されている場合（2回目のスキャン = 商品バーコード）
        if (scannedCode === storedStoreCode) {
            checkResultDisplay.textContent = 'OK';
            checkResultDisplay.style.color = 'green';
            currentStateDisplay.textContent = '検品完了: OK！次の店舗コードをスキャンしてください';
            currentStateDisplay.style.color = 'green';
            updateDebugInfo('検品結果: OK (コード一致)', 'green');
            alert('検品結果: OK');
        } else {
            checkResultDisplay.textContent = 'NG';
            checkResultDisplay.style.color = 'red';
            currentStateDisplay.textContent = '検品完了: NG...次の店舗コードをスキャンしてください';
            currentStateDisplay.style.color = 'red';
            updateDebugInfo('検品結果: NG (コード不一致)', 'red');
            alert(`検品結果: NG\n店舗コード: ${storedStoreCode}\n商品コード: ${scannedCode}`);
        }
        // 検品が完了したら、次のサイクルに備えて店舗コードをリセット
        storedStoreCode = null;
        storedCodeDisplay.textContent = 'なし';
    }
}

// ページロード時にスキャナーを自動開始
document.addEventListener('DOMContentLoaded', () => {
    startScanner();
});

// アプリケーションが閉じられる前にスキャナーを停止する (任意)
window.addEventListener('beforeunload', async () => {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            updateDebugInfo("Scanner stopped on unload.", 'grey');
        } catch (err) {
            console.error("Error stopping scanner on unload:", err);
        }
    }
});