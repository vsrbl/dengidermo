export const input = {
    w:false,
    a:false,
    s:false,
    d:false
};

export function setupInput() {

    window.addEventListener('keydown', e => {

        switch(e.code) {

            case 'KeyW':
                input.w = true;
                break;

            case 'KeyA':
                input.a = true;
                break;

            case 'KeyS':
                input.s = true;
                break;

            case 'KeyD':
                input.d = true;
                break;
        }
    });

    window.addEventListener('keyup', e => {

        switch(e.code) {

            case 'KeyW':
                input.w = false;
                break;

            case 'KeyA':
                input.a = false;
                break;

            case 'KeyS':
                input.s = false;
                break;

            case 'KeyD':
                input.d = false;
                break;
        }
    });
}
