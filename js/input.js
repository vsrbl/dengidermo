export const input = {

    w:false,
    a:false,
    s:false,
    d:false
};

export function setupInput() {

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
}
