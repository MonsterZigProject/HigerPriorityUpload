import Bundlr from '@bundlr-network/client';

export default async function handler(req, res) {
  const FileType = await import('file-type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { method, params } = req.body;

    if (method === 'uploadToArweave') {
      const { privateKey, fileData } = params;
      if (!privateKey || !fileData) {
        return res.status(400).json({ error: "Missing privateKey or fileData" });
      }

      const buffer = Buffer.from(fileData, 'base64');
      const detectedType = await FileType.fileTypeFromBuffer(buffer);
      const contentType = detectedType ? detectedType.mime : 'application/octet-stream';

      const bundlr = new Bundlr('https://node1.bundlr.network', 'matic', privateKey);

      let bundlrBalanceAtomic = await bundlr.getLoadedBalance();
      let bundlrBalanceMatic = bundlr.utils.unitConverter(bundlrBalanceAtomic).toNumber();

      console.log(`Bundlr balance: ${bundlrBalanceMatic} MATIC`);

      if (bundlrBalanceMatic < 0.1) { // prioritize: maintain high balance
        console.log("Low Bundlr balance, funding more...");
        await bundlr.fund(bundlr.utils.toAtomic(0.02));
        bundlrBalanceAtomic = await bundlr.getLoadedBalance();
        bundlrBalanceMatic = bundlr.utils.unitConverter(bundlrBalanceAtomic).toNumber();
        console.log(`New Bundlr balance: ${bundlrBalanceMatic} MATIC`);
      }

      // create, sign, upload
      const tx = bundlr.createTransaction(buffer, {
        tags: [{ name: "Content-Type", value: contentType }]
      });
      await tx.sign();

      console.log("Uploading transaction to Bundlr...");
      const result = await tx.upload();

      console.log("✅ Uploaded to Arweave:", `https://arweave.net/${tx.id}`);

      return res.status(200).json({
        result: `https://arweave.net/${tx.id}`,
        contentType,
        upload: result
      });
    }

    return res.status(400).json({ error: "Unknown method" });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
