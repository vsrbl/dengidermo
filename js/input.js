export const input = {
    w:false,
    a:false,
    s:false,
    d:false,
    mouseX:0,
    mouseY:0,
    mouseDown:false
};

export function setupInput(canvas) {

    window.addEventListener('keydown', e => {

        const k = e.key.toLowerCase();

        if(input.hasOwnProperty(k)) {
            input[k] = true;
        }
    });

    window.addEventListener('keyup', e => {

        const k = e.key.toLowerCase();

        if(input.hasOwnProperty(k)) {
            input[k] = false;
        }
    });

    canvas.addEventListener('mousedown', () => {
        input.mouseDown = true;
    });

    canvas.addEventListener('mouseup', () => {
        input.mouseDown = false;
    });

    canvas.addEventListener('mousemove', e => {

        const rect = canvas.getBoundingClientRect();

        input.mouseX = e.clientX - rect.left;
        input.mouseY = e.clientY - rect.top;
    });
}
