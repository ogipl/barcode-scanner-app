// script.js

// HTML要素への参照を取得
const storeCodeDisplay = document.getElementById('storeCodeDisplay');
const productCodeDisplay = document.getElementById('productCodeDisplay');
const resultDisplay = document.getElementById('resultDisplay'); // 検品結果用
const currentScanModeDisplay = document.getElementById('currentScanMode'); // 現在のスキャンモード表示用
const appResultDisplay = document.getElementById('result'); // アプリ全体の共通結果表示（以前のresult）
const debugInfoDisplay = document.getElementById('debug-info');

// グローバル変数
let html5QrCode;
let currentScanMode = ''; // 'storeCode' または 'productCode'
let storedStoreCode = null; // 保持する店舗コード

// デバッグ情報を表示するためのヘルパー関数
function updateDebugInfo(message, color = 'grey') {
    debugInfoDisplay.textContent = `Debug: ${new Date().toLocaleTimeString()} - ${message}`;
    debugInfoDisplay.style.color = color;
    console.log(`[DEBUG] ${message}`); // コンソールにも出力
}

// =======================================================
// スキャンモード設定関数
// =======================================================
async function setScanMode(mode) {
    currentScanMode = mode;
    currentScanModeDisplay.textContent = `現在のスキャンモード: **${mode === 'storeCode' ? '店舗コード' : '商品バーコード'}**`;
    resultDisplay.textContent = ''; // 検品結果をクリア

    updateDebugInfo(`Scan mode set to: ${mode}`, 'blue');
    appResultDisplay.textContent = `${mode === 'storeCode' ? '店舗コード' : '商品バーコード'}をスキャンしてください...`;
    appResultDisplay.style.color = 'blue';

    // スキャンを開始
    await startScanner();
}

// =======================================================
// バーコードスキャン開始関数 (html5-qrcode用)
// =======================================================
async function startScanner() {
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
        videoConstraints: {
            facingMode: { exact: "environment" }, // 背面カメラを厳密に要求
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
                updateDebugInfo(`Barcode detected: ${decodedText} in mode: ${currentScanMode}`, 'green');
                handleBarcodeScan(decodedText); // 新しいハンドリング関数を呼び出す
                stopScanner(); // スキャン後停止
            },
            (errorMessage) => {
                // スキャンエラー時のコールバック (連続的に発生することがあるので、デバッグ用)
                // updateDebugInfo(`Scan Error: ${errorMessage}`, 'orange');
            }
        );
        updateDebugInfo("Camera started successfully. Ready to scan.", 'green');
        appResultDisplay.textContent = "バーコードをかざしてください";
        appResultDisplay.style.color = "blue";

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
        appResultDisplay.textContent = errorMessage;
        appResultDisplay.style.color = "red";
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

// =======================================================
// バーコードスキャン結果のハンドリング関数
// =======================================================
function handleBarcodeScan(scannedCode) {
    if (currentScanMode === 'storeCode') {
        storedStoreCode = scannedCode;
        storeCodeDisplay.textContent = storedStoreCode;
        productCodeDisplay.textContent = '未スキャン'; // 商品コード表示をリセット
        resultDisplay.textContent = ''; // 検品結果をリセット
        appResultDisplay.textContent = `店舗コードを保持しました: ${storedStoreCode}`;
        appResultDisplay.style.color = 'green';
        updateDebugInfo(`Store code stored: ${storedStoreCode}`, 'green');
        alert(`店舗コードを保存しました: ${storedStoreCode}\n次に商品バーコードをスキャンしてください。`);

    } else if (currentScanMode === 'productCode') {
        productCodeDisplay.textContent = scannedCode;
        updateDebugInfo(`Product code scanned: ${scannedCode}`, 'green');

        if (storedStoreCode === null) {
            resultDisplay.textContent = 'エラー: 店舗コードが先にスキャンされていません！';
            resultDisplay.style.color = 'red';
            appResultDisplay.textContent = 'エラー: 店舗コードが先にスキャンされていません！';
            appResultDisplay.style.color = 'red';
            updateDebugInfo('Error: Store code not scanned yet.', 'red');
            alert('エラー: 店舗コードが先にスキャンされていません！');
            return;
        }

        if (scannedCode === storedStoreCode) {
            resultDisplay.textContent = 'OK';
            resultDisplay.style.color = 'green';
            appResultDisplay.textContent = '検品結果: OK';
            appResultDisplay.style.color = 'green';
            updateDebugInfo('Result: OK (Codes match)', 'green');
            alert('検品結果: OK');
        } else {
            resultDisplay.textContent = 'NG';
            resultDisplay.style.color = 'red';
            appResultDisplay.textContent = '検品結果: NG';
            appResultDisplay.style.color = 'red';
            updateDebugInfo('Result: NG (Codes mismatch)', 'red');
            alert(`検品結果: NG\n店舗コード: ${storedStoreCode}\n商品コード: ${scannedCode}`);
        }
        storedStoreCode = null; // 検品が完了したら店舗コードをリセット
    } else {
        updateDebugInfo('No scan mode set. Please click a scan button.', 'orange');
        appResultDisplay.textContent = 'スキャンモードを選択してください。';
        appResultDisplay.style.color = 'orange';
    }
}

// ページロード時に何もスキャンモードが設定されていない状態にする
document.addEventListener('DOMContentLoaded', () => {
    currentScanModeDisplay.textContent = `現在のスキャンモード: **未選択**`;
    appResultDisplay.textContent = 'スキャンを開始するには、上のボタンを押してください。';
    appResultDisplay.style.color = 'black';
    updateDebugInfo('Application loaded. Awaiting scan mode selection.', 'grey');
});

// アプリケーションが閉じられる前にスキャナーを停止する (任意)
window.addEventListener('beforeunload', () => {
    stopScanner();
});