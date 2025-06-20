// script.js

// HTML要素への参照を取得
const currentStateDisplay = document.getElementById('currentStateDisplay');
const storedCodeDisplay = document.getElementById('storedCodeDisplay');
const scannedCodeDisplay = document.getElementById('scannedCodeDisplay');
const checkResultDisplay = document.getElementById('checkResultDisplay');
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
    console.log(`[DEBUG] ${message}`);
}

// 状態メッセージを更新するヘルパー関数
function updateStatus(message, color = 'black', autoClearMs = 0) {
    currentStateDisplay.textContent = message;
    currentStateDisplay.style.color = color;
    if (autoClearMs > 0) {
        setTimeout(() => {
            if (currentStateDisplay.textContent === message) { // 同じメッセージの場合のみクリア
                currentStateDisplay.textContent = '準備中...';
                currentStateDisplay.style.color = 'black';
            }
        }, autoClearMs);
    }
}

// 検品結果を更新するヘルパー関数
function updateCheckResult(message, color = 'black', autoClearMs = 0) {
    checkResultDisplay.textContent = message;
    checkResultDisplay.style.color = color;
    if (autoClearMs > 0) {
        setTimeout(() => {
            if (checkResultDisplay.textContent === message) { // 同じメッセージの場合のみクリア
                checkResultDisplay.textContent = '';
                checkResultDisplay.style.color = 'black';
            }
        }, autoClearMs);
    }
}


// =======================================================
// バーコードスキャン開始関数 (html5-qrcode用)
// =======================================================
async function startScanner() {
    updateStatus('カメラ起動中...', 'blue');
    updateDebugInfo("Initializing HTML5-QRCode scanner for continuous scanning...", 'blue');

    const qrCodeRegionId = "qr-reader";

    // 既にインスタンスがあれば停止
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            updateDebugInfo("Previous scanner stopped.", 'grey');
        } catch (e) {
            updateDebugInfo(`Error stopping previous scanner: ${e}`, 'orange');
        }
    }
    html5QrCode = new Html5Qrcode(qrCodeRegionId);

    const qrCodeConfig = {
        fps: 10, // Frames per second for scanning
        // qrbox のサイズを再調整。
        // 広めのサイズに設定し、スキャン精度とクールダウンロジックとの相性を良くする
        qrbox: { width: 280, height: 280 }, // この値を再調整 (少し大きく)
        videoConstraints: {
            facingMode: { exact: "environment" }, // 背面カメラを強制
            // ideal な解像度は指定せず、ブラウザに最適なものを選ばせることで、
            // カメラ起動の安定性を高めます。
        },
    };

    try {
        await html5QrCode.start(
            qrCodeConfig.videoConstraints,
            qrCodeConfig,
            (decodedText, decodedResult) => {
                // スキャン成功時のコールバック
                // クールダウン中でない、かつ前回スキャンしたバーコードと異なる場合のみ処理
                if (!scanCooldownActive && decodedText !== lastScannedCode) {
                    scanCooldownActive = true; // クールダウン開始
                    lastScannedCode = decodedText; // 今回スキャンしたコードを記録
                    updateDebugInfo(`Barcode detected: ${decodedText}`, 'green');
                    handleBarcodeScan(decodedText); // スキャン結果を処理

                    // スキャン結果処理後、一定時間クールダウンを維持
                    // このクールダウン中に同じバーコードが再検出されても処理を無視します。
                    // ユーザーがバーコードを画面から外す時間を十分に確保するため、長めに設定
                    setTimeout(() => {
                        scanCooldownActive = false;
                        lastScannedCode = null; // クールダウン終了時に前回スキャンコードをリセット
                        updateDebugInfo("Cooldown finished. Ready for next scan.", 'blue');
                        // クールダウン終了後に、現在の状態に応じたメッセージを表示
                        if (storedStoreCode === null) {
                            updateStatus('店舗コードをスキャンしてください', 'black');
                        } else {
                            updateStatus('商品バーコードをスキャンしてください', 'blue');
                        }
                    }, 3000); // 3秒のクールダウン (前回より長く)

                } else if (scanCooldownActive) {
                    updateDebugInfo(`Ignoring scan during cooldown: ${decodedText}`, 'orange'); 
                } else if (decodedText === lastScannedCode) {
                    updateDebugInfo(`Ignoring duplicate scan: ${decodedText}`, 'orange'); 
                }
            },
            (errorMessage) => {
                // スキャンエラー時のコールバックは通常ログに出さない（大量に出るため）
                // updateDebugInfo(`Scan Error: ${errorMessage}`, 'orange');
            }
        );
        updateDebugInfo("Camera started successfully. Ready to scan continuously.", 'green');
        updateStatus('店舗コードをスキャンしてください', 'black');
        storedCodeDisplay.textContent = 'なし';
        scannedCodeDisplay.textContent = 'なし';
        updateCheckResult(''); // 初期化

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
        updateStatus(errorMessage, 'red');
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
        updateStatus('商品バーコードをスキャンしてください', 'blue');
        updateCheckResult('店舗コードを保存しました', 'green', 2000); // UIメッセージ
        updateDebugInfo(`店舗コードを保持しました: ${storedStoreCode}`, 'green');

    } else {
        // 店舗コードが既に保持されている場合（2回目のスキャン = 商品バーコード）
        if (scannedCode === storedStoreCode) {
            updateCheckResult('OK', 'green');
            updateStatus('検品完了: OK！次の店舗コードをスキャンしてください', 'green');
            updateDebugInfo('検品結果: OK (コード一致)', 'green');
        } else {
            updateCheckResult('NG', 'red');
            updateStatus('検品完了: NG...次の店舗コードをスキャンしてください', 'red');
            updateDebugInfo('検品結果: NG (コード不一致)', 'red');
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