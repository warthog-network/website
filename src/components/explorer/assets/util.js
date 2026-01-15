export function abbreviate(hex) {
    if (hex.length > 8)
        return hex.slice(0,4)+"..."+hex.slice(-4)
    return hex
}
export function format_height(height){
    return height.toLocaleString('en-US')
}
export function loglevel_symbol(loglevel){
    switch (loglevel) {
        case 'info':
            return '🛈 ';
        case 'warning':
            return '⚠ ';
        case 'error':
            return '!!';
        default:
            return '?';
    }
}
export function format_timestamp(timestampMilliseconds){
    var date = new Date(timestampMilliseconds);
    return date.getMonth()+"/"+date.getDay()+" "+date.getHours() +":"+ date.getMinutes()+":"+date.getSeconds() +"."+date.getMilliseconds()

}
