
// Usage
const inputText = `ନାମ: John Doe  

          Age: 67     Gender : Female   ସ୍ବାମୀଙ୍କ ନାମ: ସଂଜୟ ବେହେରା   extra unrelated text`;

function extractKeyValues(inputText) {
    const result = {};
    const defkeys = [
        ["ନାମ", "Name"],
        ["ବୟସ", "Age"],
        ["ଲିଂଗ", "Gender"],
        ["ନଂ", "No", "ନମ୍ବର"],
        ["ସ୍ବାମୀଙ୍କ ନାମ", "Husband Name", "ସ୍ୱାମୀ", "Husband", "ପିତାଙ୍କ ନାମ", "Father Name", "ମାତାଙ୍କ ନାମ", "Mother Name"],
    ];

    // Flatten all key alternatives for the lookahead pattern
    const allKeyAlternatives = keys.flatMap(key =>
        Array.isArray(key) ? key : [key]
    );

    keys.forEach((key) => {
        let keyPattern, keyName;

        if (Array.isArray(key)) {
            // If key is an array, create alternation pattern (key1|key2|key3)
            keyPattern = key
                .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join("|");
            // Find the matched key in the input text
            const matchedKey = key.find(k => {
                const regex = new RegExp(`(?:${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*:`, "i");
                return regex.test(inputText);
            });
            keyName = matchedKey || key[0];
        } else {
            // Single key
            keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            keyName = key;
        }

        // Create lookahead pattern that includes all possible key alternatives
        const nextKeyPattern = allKeyAlternatives
            .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");

        // Match the key, optional spaces/newlines, colon, and capture value until next key or end
        const regex = new RegExp(
            `(?:${keyPattern})\\s*:\\s*(.+?)(?=\\s*(?:${nextKeyPattern})\\s*:|$)`,
            "is"
        );
        const match = inputText.match(regex);

        if (match) {
            let value = match[1].trim();

            // Split on newlines or 3+ consecutive spaces and take only the first part
            const parts = value.split(/\n+|\s{3,}/);
            value = parts[0].trim();

            result[keyName] = value;
        }
    });

    return result;
}

module.exports = { extractKeyValues };
// const values = extractKeyValues(inputText, keys);

// console.log(values);