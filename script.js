// script.js

// HTML要素への参照を取得 (html5-qrcodeでは、video要素を直接操作することは少なくなります)
const resultDisplay = document.getElementById('result');
const debugInfoDisplay = document.getElementById('debug-info');

// デバッグ情報を表示するためのヘルパー関数
function updateDebugInfo(message, color = 'grey') {
    debugInfoDisplay.textContent = `Debug: ${new Date().toLocaleTimeString()} - ${message}`;
    debugInfoDisplay.style.color = color;
    console.log(`[DEBUG] ${message}`); // コンソールにも出力
}

// html5-qrcodeのインスタンス
let html5QrCode;

// =======================================================
// バーコードスキャン開始関数 (html5-qrcode用)
// =======================================================
async function startScanner() {
    resultDisplay.textContent = "カメラ起動中...";
    resultDisplay.style.color = "blue";
    updateDebugInfo("Initializing HTML5-QRCode scanner...", 'blue');

    const qrCodeRegionId = "qr-reader"; // index.htmlで指定したdivのID

    // 既にインスタンスが存在し、スキャン中であれば停止してから再起動
    if (html5QrCode && html5QrCode.isScanning) {
        await stopScanner();
    }
    // インスタンスがなければ新しく作成
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode(qrCodeRegionId);
    }


    // カメラの制約を設定
    const qrCodeConfig = {
        fps: 10, // フレームレート
        qrbox: { width: 250, height: 250 }, // スキャン領域のボックスサイズ (任意)
        // ルックアップオーダーで制約を設定
        // 1. 環境設定 (背面カメラ優先)
        // 2. 幅と高さの理想値
        // 3. 幅と高さの最小値
        videoConstraints: {
            facingMode: { exact: "environment" }, // 背面カメラを厳密に要求
            width: { ideal: 640 },
            height: { ideal: 480 },
            // min/maxを設定することも可能ですが、idealが推奨されます
        },
        // preferFrontCamera: false, // 前面カメラを優先しない（背面カメラを優先）
        // disableFlip: false, // スキャン画像を反転しない
    };

    try {
        // スキャンを開始
        await html5QrCode.start(
            qrCodeConfig.videoConstraints, // カメラ制約
            qrCodeConfig, // 設定
            (decodedText, decodedResult) => {
                // スキャン成功時のコールバック
                updateDebugInfo(`Barcode detected: ${decodedText}`, 'green');
                resultDisplay.textContent = `スキャン結果: ${decodedText}`;
                resultDisplay.style.color = "green";
                console.log("Barcode detected:", decodedText, decodedResult);

                // スキャンを停止 (連続スキャンを防ぐため)
                stopScanner();

                // ここでサーバーにデータを送信するなどの処理を追加できます
                // 例: google.script.run.saveStoreCode(decodedText);
            },
            (errorMessage) => {
                // スキャンエラー時のコールバック (連続的に発生することがあるので、デバッグ用)
                // updateDebugInfo(`Scan Error: ${errorMessage}`, 'orange'); // これは大量に出る可能性があるので通常はコメントアウト
            }
        );
        updateDebugInfo("Camera started successfully. Ready to scan.", 'green');
        resultDisplay.textContent = "バーコードをかざしてください";
        resultDisplay.style.color = "blue";

    } catch (err) {
        // カメラ起動失敗時のエラーハンドリング
        updateDebugInfo(`HTML5-QRCode Start Error: ${err.name || err.message || err.toString()}`, 'red');
        console.error("HTML5-QRCode 起動エラー詳細:", err);

        let errorMessage = "カメラの起動に失敗しました。";
        if (err.name === 'NotAllowedError') {
            errorMessage += " カメラへのアクセスが拒否されました。ブラウザの許可設定とiPhoneの設定（プライバシー->カメラ）を確認してください。";
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
        resultDisplay.textContent = errorMessage;
        resultDisplay.style.color = "red";
        // alert(errorMessage); // アラートはユーザー体験を損ねるのでコメントアウト
    }
}

// =======================================================
// バーコードスキャン停止関数
// =======================================================
async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            updateDebugInfo("Scanner stopped.", 'grey');
        } catch (err) {
            updateDebugInfo(`Error stopping scanner: ${err.name || err.message || err.toString()}`, 'red');
            console.error("Scanner stop error:", err);
        }
    }
}

// ページロード時にスキャナーを自動開始
document.addEventListener('DOMContentLoaded', () => {
    // 適切なタイミングでstartScannerを呼び出す
    startScanner();
});

// アプリケーションが閉じられる前にスキャナーを停止する (任意)
window.addEventListener('beforeunload', () => {
    stopScanner();
});