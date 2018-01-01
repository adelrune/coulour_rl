function GameObject(position, has_collision, has_default_interaction, repr, animation) {
    // Will the player trigger an action by trying to walk in that thing.
    this.has_default_interaction = has_default_interaction;
    this.position = position;
    this.has_collision = has_collision;
    // This will generally be false for things that moves a lot
    this.persistent_memory = true;
    this.visible = false;
    // changes the repr, false if not selected, is a number for the selection level.
    this.selected = false;
    // repr this was last seen as
    this.remembered_as = null;
    this.repr = repr;
    this.animation = animation !== undefined ? animation : null;
    if (typeof(this.repr) === "string") {
        // If no colour is set, its white.
        this.repr = {"symbol":this.repr, "colour":[255,255,255], "bg":[35,35,35]}
    }

    // gets the next repr in the animation (or the static repr otherwise)
    this.next_repr = function() {
        if (this.visible) {
            repr = clone(this.animation !== null ? this.animation.next() : this.repr);
        } else if (this.remembered_as) {
            repr = clone(this.remembered_as);
            // we tell the thing its a memory, display is up to the view.
            repr.memory = true;
        } else {
            // returns null if it doesn't have a valid display
            return null;
        }
        if (this.selected) {
            repr.bg = [100+this.selected*24,100+this.selected*24,100+this.selected*24];
        } else {
            repr.bg = repr.bg;
        }
        return repr;
    }

    this.light_passes = function() {
        return ! this.has_collision;
    }
    // deals with remembered_as and visible.
    this.set_visible = function() {
        this.visible = true;
        // We don't remember things that aren't persistent
        this.remembered_as = this.persistent_memory ? this.repr : null;
    }
}

// An animated thing
var Animation = function(frames, loop) {
    this.frames = frames;
    this.index = 0;
    this.loop = loop;
    this.finished = false;
}

Animation.prototype.next = function() {
    var repr = this.frames[this.index];
    this.index += 1;
    this.finished = this.index == this.frames.length && !this.loop;
    this.index %= this.frames.length;
    return repr;
}

var Ability = function(base_delay, apply) {
    this.base_delay = base_delay;
    this.apply = apply;
}

var Particle = function(frames, next_func, position) {
    Animation.call(this, frames, false);
    this.position = position;
    this.next_func = next_func;
    this.next = function() {
        repr = Animation.prototype.next.call(this);
        this.next_func();
        return repr;
    };
}

// spells are going to be made on the fly like that
// right now it does nothing interesting.
function make_ability(args) {
    function effect() {
        var positions = game.current_map.get_selected_positions();
        var affected = game.current_map.get_selected_entities();
        for (var i = 0; i < positions.length; i++) {
            p = new Particle (
                [{"symbol": '§', "colour":[13,0,0]}, {"symbol": '§', "colour":[26,0,0]}],
                function() {
                    if (this.frames.length == 2) {
                        factor = Math.floor(Math.random() * 15) + 5;
                        for (var i = 0; i < factor; i++) {
                            var ichelou = i-5;
                            ichelou = ichelou < 0 ? 0 : ichelou;
                            this.frames.push({"symbol":'§',"colour":[55 + 10*i,0,0], "bg":[255 - 9*i,10*(factor-5) - ichelou*9,0]});
                        }
                    }
                },
                positions[i]
            );
            game.current_map.particles.push(p);
        }
        for (var i = 0; i < affected.length; i++) {
            affected[i].health -= 5;
            game.message_log.push(affected[i].name + " is engulfed in flames " + " for "+5+"damage");
        }
        game.change_mode(GAME)
        return 5
    }
    return new Ability(5, function(args) {
        game.change_mode(SELECTION, effect, make_round_selection(3), {limit:"sight"});
    });
}



/*var Spell = function(primary, modifier, shape) {

}*/

function Floor(repr) {
    GameObject.call(this, null, false, false, repr);
}

function Wall(repr) {
    GameObject.call(this, null, true, false, repr);
}

function Actor(position, health, repr, name) {
    // Actor has collision and default interaction
    GameObject.call(this, position, true, true, repr);
    this.health = health;
    this.move_delay = 10;
    this.name = name;
    this.persistent_memory = false;
    this.move = function (args) {
        // args : movement, map
        var new_pos = [];
        for (var i = 0; i < args.movement.length; i++) {
            new_pos.push(args.movement[i] + this.position[i]);
        }

        var collided = check_collisions(args.map, new_pos);

        if(collided && collided.has_default_interaction) {
            return collided.default_interaction(this);
        } else if (collided) {
            // collision with non interactable things are only permitted for players.
            // we don't want to penalise a missinput so we return a null as a sign that nothing should happen
            return null
        } else if (args.map.grid[new_pos[0]][new_pos[1]]) {
            this.position = new_pos;
        }
        // 10 arbitrary units of time
        return this.move_delay;
    }
    this.use_ability = function(args) {
        var ability = make_ability(args);
        return ability.apply(args);
    }
}

function NPC(position, health, repr, name) {
    Actor.call(this, position, health, repr, name);
    this.move_delay = 10;
    this.get_next_action = function() {
        if(!check_collisions(game.current_map, [1+this.position[0],0+this.position[1]])) {
            return this.move({"map":game.current_map, movement:[1,0]});
        } else {
            return this.move_delay;
        }
    }

    this.default_interaction = function(entity) {
        return resolve_attack(entity, this);
    }
}

function resolve_attack(attacker, attacked) {
    // TODO: stats and all that bullshit
    var damage = 10;
    attacked.health -= damage;
    game.message_log.push(attacker.name + " attacks " +attacked.name + " for " + damage);
    // TODO: change by attack delay
    return attacker.move_delay
}