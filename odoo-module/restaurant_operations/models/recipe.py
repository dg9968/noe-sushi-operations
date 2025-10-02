from odoo import models, fields, api
from odoo.exceptions import ValidationError

class Recipe(models.Model):
    _name = 'restaurant.recipe'
    _description = 'Restaurant Recipe'
    _order = 'name'

    name = fields.Char('Recipe Name', required=True)
    category = fields.Selection([
        ('appetizer', 'Appetizer'),
        ('sushi', 'Sushi'),
        ('sashimi', 'Sashimi'),
        ('roll', 'Roll'),
        ('dessert', 'Dessert'),
        ('beverage', 'Beverage'),
        ('other', 'Other'),
    ], string='Category', required=True, default='other')
    
    ingredient_ids = fields.One2many('restaurant.recipe.ingredient', 'recipe_id', string='Ingredients')
    instruction_ids = fields.One2many('restaurant.recipe.instruction', 'recipe_id', string='Instructions')
    
    prep_time = fields.Integer('Preparation Time (minutes)', default=0)
    serving_size = fields.Integer('Serving Size', default=1)
    
    total_cost = fields.Float('Total Cost', compute='_compute_total_cost', store=True)
    cost_per_serving = fields.Float('Cost per Serving', compute='_compute_cost_per_serving', store=True)
    
    notes = fields.Text('Notes')
    active = fields.Boolean('Active', default=True)

    @api.depends('ingredient_ids.total_cost')
    def _compute_total_cost(self):
        for recipe in self:
            recipe.total_cost = sum(ingredient.total_cost for ingredient in recipe.ingredient_ids)

    @api.depends('total_cost', 'serving_size')
    def _compute_cost_per_serving(self):
        for recipe in self:
            if recipe.serving_size > 0:
                recipe.cost_per_serving = recipe.total_cost / recipe.serving_size
            else:
                recipe.cost_per_serving = 0.0

    @api.constrains('serving_size')
    def _check_serving_size(self):
        for recipe in self:
            if recipe.serving_size <= 0:
                raise ValidationError("Serving size must be greater than 0")


class RecipeIngredient(models.Model):
    _name = 'restaurant.recipe.ingredient'
    _description = 'Recipe Ingredient'

    recipe_id = fields.Many2one('restaurant.recipe', string='Recipe', required=True, ondelete='cascade')
    product_id = fields.Many2one('product.product', string='Product', required=True)
    quantity = fields.Float('Quantity', required=True, default=1.0)
    uom_id = fields.Many2one('uom.uom', string='Unit of Measure', required=True)
    
    unit_cost = fields.Float('Unit Cost', related='product_id.standard_price', store=True)
    total_cost = fields.Float('Total Cost', compute='_compute_total_cost', store=True)

    @api.depends('quantity', 'unit_cost')
    def _compute_total_cost(self):
        for ingredient in self:
            ingredient.total_cost = ingredient.quantity * ingredient.unit_cost

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.uom_id = self.product_id.uom_id


class RecipeInstruction(models.Model):
    _name = 'restaurant.recipe.instruction'
    _description = 'Recipe Instruction'
    _order = 'sequence'

    recipe_id = fields.Many2one('restaurant.recipe', string='Recipe', required=True, ondelete='cascade')
    sequence = fields.Integer('Sequence', default=10)
    instruction = fields.Text('Instruction', required=True)