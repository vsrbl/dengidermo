export const input = {
    w:false,
    a:false,
    s:false,
    d:false
};

function isMovementKey(code) {
    return code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'ArrowUp' ||
        code === 'ArrowLeft' ||
        code === 'ArrowDown' ||
        code === 'ArrowRight';
}

export function resetInput() {
    input.w = false;
    input.a = false;
    input.s = false;
    input.d = false;
}

function setKey(code, value) {
    switch(code) {

        case 'KeyW':
        case 'ArrowUp':
            input.w = value;
            break;

        case 'KeyA':
        case 'ArrowLeft':
            input.a = value;
            break;

        case 'KeyS':
        case 'ArrowDown':
            input.s = value;
            break;

        case 'KeyD':
        case 'ArrowRight':
            input.d = value;
            break;
    }
}

export function setupInput() {

    window.addEventListener('keydown', e => {

        if(!isMovementKey(e.code)) {
            return;
        }

        e.preventDefault();

        setKey(e.code, true);
    });

    window.addEventListener('keyup', e => {

        if(!isMovementKey(e.code)) {
            return;
        }

        e.preventDefault();

        setKey(e.code, false);
    });

    window.addEventListener('blur', resetInput);

    document.addEventListener('visibilitychange', () => {
        if(document.hidden) {
            resetInput();
        }
    });
}
