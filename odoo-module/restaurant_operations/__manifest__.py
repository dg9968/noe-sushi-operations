{
    'name': 'Noe Sushi Bar Operations',
    'version': '1.0.0',
    'summary': 'Restaurant Operations Management System',
    'description': """
        Comprehensive restaurant operations management system for Noe Sushi Bar including:
        - Recipe management with cost calculation
        - Document management
        - Inventory integration
        - Real-time pricing updates
    """,
    'author': 'Noe Sushi Bar',
    'website': 'https://noe-sushi-bar.com',
    'category': 'Restaurant Management',
    'depends': ['base', 'product', 'stock', 'account'],
    'data': [
        'security/ir.model.access.csv',
        'views/recipe_views.xml',
        'views/document_views.xml',
        'views/menu_views.xml',
        'data/recipe_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'restaurant_operations/static/src/css/restaurant_operations.css',
            'restaurant_operations/static/src/js/recipe_manager.js',
        ],
        'web.assets_frontend': [
            'restaurant_operations/static/src/css/frontend.css',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}