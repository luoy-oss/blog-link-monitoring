/**
 * 标准化URL格式，移除末尾斜杠
 * @param {string} url - 原始URL
 * @returns {string} - 标准化后的URL
 */
function normalizeUrl(url) {
    return url.replace(/\/$/, '');
}

module.exports = {
    normalizeUrl
};