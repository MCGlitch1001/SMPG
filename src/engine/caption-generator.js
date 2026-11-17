export function generateCaption({
    firstQuote = "Lock in",
    topic = "Discipline",
    mode = "carousel",
    watermark = null
}) {
    const cleanQuote = firstQuote.replace(/[".“”]/g, '').trim();
    const handle = watermark || "@discipline.archive";

    const hashtags = [
        "#mindset", "#discipline", "#stoicism", "#mentality",
        "#grindset", "#success", "#motivation", "#focus",
        "#1percentclub", "#hardwork", "#stoicmindset"
    ];

    if (mode === 'reel') {
        return `${cleanQuote}.

The road to the top is silent. Cut through the noise and build your reality.

Follow ${handle} for daily mental armor.
Drop a ⚔️ if you agree.

${hashtags.join(' ')}`;
    }

    return `${cleanQuote}...

Swipe through to internalize these truths. 

Follow ${handle} for daily mental calibration and relentless focus.
Save this post for when motivation runs dry.

${hashtags.join(' ')}`;
}
