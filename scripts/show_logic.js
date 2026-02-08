import { spawnSync } from 'child_process';
import fs from 'fs';

const TARGET_USER = "U03d92f2cc0d998fcf4c81e69735e12ee";
const LOGIC_PATH = "documents/mir_logic/mir_tutor_role.md";

function showLogic() {
    if (fs.existsSync(LOGIC_PATH)) {
        const content = fs.readFileSync(LOGIC_PATH, 'utf8');
        const msg = `【MIR 導師核心邏輯設定檔】\n---\n${content}`;
        
        spawnSync('moltbot', [
            'message', 'send',
            '--target', TARGET_USER,
            '--message', msg,
            '--channel', 'line'
        ]);
        console.log("Logic sent to LINE.");
    } else {
        console.error("Logic file not found.");
    }
}

showLogic();
