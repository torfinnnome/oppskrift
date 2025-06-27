import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Recipe } from '@/types/recipe';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import no from '@/locales/no.json';

const translations: { [key: string]: any } = {
  en,
  es,
  no,
};

const getTranslation = (lang: string, key: string) => {
  return translations[lang]?.[key] || translations.en[key];
};

// Function to generate Markdown content
const generateMarkdown = (recipe: Recipe, t: (key: string) => string) => {
  let markdown = `# ${recipe.title}

`;
  if (recipe.description) {
    markdown += `${recipe.description}

`;
  }
  markdown += `## ${t("ingredients")}

`;
  recipe.ingredientGroups.forEach(group => {
    if (group.name) {
      markdown += `### ${group.name}
`;
    }
    group.ingredients.forEach(ingredient => {
      markdown += `- ${ingredient.quantity} ${ingredient.unit} ${ingredient.name}
`;
    });
  });
  markdown += `
## ${t("instructions")}

`;
  recipe.instructions.forEach((step, index) => {
    markdown += `${index + 1}. ${step.text}
`;
  });
  if (recipe.tips && recipe.tips.length > 0) {
    markdown += `
## ${t("tips_label")}

`;
    recipe.tips.forEach(tip => {
      markdown += `- ${tip.text}
`;
    });
  }
  return markdown;
};

// Function to generate HTML content
const generateHtml = (recipe: Recipe, t: (key: string) => string) => {
  let html = `
    <html>
    <head>
        <title>${recipe.title}</title>
        <style>
            body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; }
            h1 { font-size: 2.5em; }
            h2 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            h3 { font-size: 1.5em; }
            ul, ol { margin-bottom: 1em; padding-left: 25px; }
            li { margin-bottom: 0.5em; }
            .section { margin-bottom: 2em; }
            .ingredient-group { margin-bottom: 1.5em; }
            .ingredient-group-name { font-weight: bold; margin-bottom: 0.5em; }
        </style>
    </head>
    <body>
        <h1>${recipe.title}</h1>
  `;

  if (recipe.description) {
    html += `<p>${recipe.description}</p>`;
  }

  html += `<div class="section">
            <h2>${t("ingredients")}</h2>
  `;
  recipe.ingredientGroups.forEach(group => {
    html += `<div class="ingredient-group">`;
    if (group.name) {
      html += `<h3 class="ingredient-group-name">${group.name}</h3>`;
    }
    html += `<ul>`;
    group.ingredients.forEach(ingredient => {
      html += `<li>${ingredient.quantity} ${ingredient.unit} ${ingredient.name}</li>`;
    });
    html += `</ul>`;
    html += `</div>`;
  });
  html += `</div>`;

  html += `<div class="section">
            <h2>${t("instructions")}</h2>
            <ol>
  `;
  recipe.instructions.forEach(step => {
    html += `<li>${step.text}</li>`;
  });
  html += `</ol>
        </div>
  `;

  if (recipe.tips && recipe.tips.length > 0) {
    html += `<div class="section">
              <h2>${t("tips_label")}</h2>
              <ul>
    `;
    recipe.tips.forEach(tip => {
      html += `<li>${tip.text}</li>`;
    });
    html += `</ul>
          </div>
    `;
  }

  html += `</body></html>`;
  return html;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const recipeId = searchParams.get('id');
  const format = searchParams.get('format') || 'json'; // Default to json
  const lang = searchParams.get('lang') || 'en'; // Default to English

  const t = (key: string) => getTranslation(lang, key);

  if (!recipeId) {
    return NextResponse.json({ message: t("recipe_id_required") }, { status: 400 });
  }

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        categories: true,
        tags: true,
        ingredientGroups: {
          include: {
            ingredients: true,
          },
        },
        instructions: true,
        tips: true,
      },
    });

    if (!recipe) {
      return NextResponse.json({ message: t("recipe_not_found") }, { status: 404 });
    }

    if (recipe.createdBy !== session.user.id) {
        return NextResponse.json({ message: t("unauthorized_action") }, { status: 403 });
    }
    
    if (format === 'markdown') {
      const markdown = generateMarkdown(recipe as unknown as Recipe, t);
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${recipe.title}.md"`,
        },
      });
    }

    if (format === 'html') {
      const html = generateHtml(recipe as unknown as Recipe, t);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${recipe.title}.html"`,
        },
      });
    }

    return NextResponse.json(recipe, { status: 200 });
  } catch (error) {
    console.error('Error exporting recipe:', error);
    return NextResponse.json({ message: t("error_exporting_recipe") }, { status: 500 });
  }
}
