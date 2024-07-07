import { Converter } from 'showdown';
import { Git } from './git';

export class FoundryWebsiteApi {

  public static async markdownToHtml(markdown: string): Promise<string> {
    const converter = new Converter({
      simplifiedAutoLink: true,
    });
    // Prefix relative links
    const githubRepository = await new Git().getGithubRepoName();
    const commitHash = await new Git().getCurrentLongHash();
    if (githubRepository && commitHash) {
      // https://github.com/TPNils/emphasis-roll/raw/c946414759bb7ad4affdf1f45f85c88b9c76ef69/assets/emphasis-roll-rule-set.jpg
      markdown = markdown.replace(/(\[(.*?[^\\](?:\\\\)*)]\()\//g, `$1https://github.com/${githubRepository}/raw/${commitHash}/`)
    }
    converter.listen('makehtml.images.after', (...args) => console.log(args))
    const html = converter.makeHtml(markdown);
    console.log(html)
    return html;
  }

}