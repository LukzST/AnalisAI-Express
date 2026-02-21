extends CharacterBody2D

# Variáveis básicas
var velocidade = 150
var pode_andar = false

# @onready serve para o código esperar os nós carregarem
@onready var texto_missao = $"../CanvasLayer/Label"

func _ready():
	# O jogo começa travado para a "intro"
	pode_andar = true
	texto_missao.show()
	
	# Timer de 2 segundos (equivalente ao setTimeout do JS)
	await get_tree().create_timer(2.0).timeout
	
	texto_missao.hide()
	pode_andar = true

func _physics_process(delta):
	if pode_andar:
		# Pega a direção das setas ou WASD
		var input_dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
		
		# velocity é uma variável nativa do CharacterBody2D
		velocity = input_dir * velocidade
		
		# move_and_slide faz a física acontecer
		move_and_slide()
